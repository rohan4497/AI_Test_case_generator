from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from typing import List, Optional
import httpx
import os
import io
import csv
import json
import anthropic
import yaml
import time
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Test Case Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ======== MODELS ========

class JiraAuth(BaseModel):
    base_url: str
    email: str
    api_token: str

class JiraTestConnection(JiraAuth):
    pass

class JiraFetchIssue(JiraAuth):
    issue_id: str

class TestCase(BaseModel):
    id: str
    title: str
    type: str # "Positive | Negative | Edge | Boundary | Security"
    priority: str # "P0 | P1 | P2"
    preconditions: str
    steps: List[str]
    test_data: str
    expected_result: str
    linked_jira_id: str

class TestCaseGenerateRequest(BaseModel):
    anthropic_api_key: Optional[str] = None # Fallback frontend can pass it
    jira_id: str
    summary: str
    description: str
    acceptance_criteria: str
    issue_type: str
    priority: str
    template_content: str # The YAML or text content of the template

class ExportRequest(BaseModel):
    format: str # "csv" or "md"
    test_cases: List[TestCase]

# ======== HELPER ========

def parse_adf(content: dict) -> str:
    """Very naive Atlassian Document Format parser"""
    if not isinstance(content, dict):
        return str(content)
    text = ""
    if content.get("type") == "text":
        text += content.get("text", "")
    for child in content.get("content", []):
        text += parse_adf(child) + "\n"
    return text.strip()

# ======== ENDPOINTS ========

@app.get("/")
def read_root():
    return {"status": "api is running"}

@app.post("/api/jira/test-connection")
async def test_jira_connection(data: JiraTestConnection):
    base_url = data.base_url.rstrip("/")
    if not base_url.startswith("http"):
        base_url = f"https://{base_url}"
    auth = (data.email, data.api_token)
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{base_url}/rest/api/3/myself", auth=auth)
            if response.status_code == 200:
                user_data = response.json()
                return {"success": True, "message": f"Connected securely as {user_data.get('displayName')}"}
            else:
                return {"success": False, "message": f"Auth failed: {response.status_code}"}
        except Exception as e:
            return {"success": False, "message": f"Connection error: {str(e)}"}

@app.post("/api/jira/fetch-issue")
async def fetch_issue(data: JiraFetchIssue):
    base_url = data.base_url.rstrip("/")
    if not base_url.startswith("http"): base_url = f"https://{base_url}"
    auth = (data.email, data.api_token)
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{base_url}/rest/api/3/issue/{data.issue_id}", auth=auth)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Failed to fetch issue: {response.status_code} {response.text}")
            
            issue = response.json()
            fields = issue.get("fields", {})
            
            # Basic parsing of description which is ADF in Jira Cloud API v3
            raw_desc = fields.get("description")
            description = parse_adf(raw_desc) if raw_desc else "No description provided."
            
            # Acceptance criteria often a custom field. We'll try to find it or mock it if missing.
            # Real-world requires finding the custom field id.
            ac = ""
            for key, val in fields.items():
                if key.startswith("customfield_") and isinstance(val, str) and "acceptance" in key.lower():
                    ac += val + "\n"
            
            if not ac:
                # Let's try searching text for AC
                if "Acceptance Criteria" in description:
                    parts = description.split("Acceptance Criteria", 1)
                    if len(parts) > 1:
                        ac = parts[1]
                else:
                    ac = "Not explicitly found. Extract from description."
                    
            components = [c.get("name") for c in fields.get("components", [])]
            return {
                "jira_id": data.issue_id,
                "summary": fields.get("summary", ""),
                "description": description,
                "acceptance_criteria": ac.strip(),
                "issue_type": fields.get("issuetype", {}).get("name", ""),
                "priority": fields.get("priority", {}).get("name", ""),
                "components": components
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error fetching issue: {str(e)}")

@app.post("/api/testcases/generate")
async def generate_testcases(data: TestCaseGenerateRequest):
    api_key = data.anthropic_api_key or os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Anthropic API Key is required.")
    
    client = anthropic.AsyncAnthropic(api_key=api_key)
    
    system_prompt = f"""You are a professional QA engineer. Your task is to generate AT LEAST 5 comprehensive test cases based on the provided user story context and template.
You must return the result as a strictly formatted JSON object with a single key 'test_cases' containing a list of test case objects.
Do not include any Markdown wrapper, just the JSON string.
Ensure each test case matches this strict JSON schema:
{{
  "id": "TC_001",
  "title": "string",
  "type": "Positive | Negative | Edge | Boundary | Security",
  "priority": "P0 | P1 | P2",
  "preconditions": "string",
  "steps": ["step 1", "step 2"],
  "test_data": "string",
  "expected_result": "string",
  "linked_jira_id": "{data.jira_id}"
}}"""

    user_prompt = f"""
Jira ID: {data.jira_id}
Type: {data.issue_type}
Priority: {data.priority}
Summary: {data.summary}

Description:
{data.description}

Acceptance Criteria:
{data.acceptance_criteria}

Template/Instructions:
{data.template_content}

Generate the test cases now. Return solely the JSON.
"""
    
    start_time = time.time()
    try:
        response = await client.messages.create(
            model="claude-3-5-sonnet-latest", # Claude Sonnet
            max_tokens=2500,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}]
        )
        latency = time.time() - start_time
        tokens_used = response.usage.input_tokens + response.usage.output_tokens
        
        raw_text = response.content[0].text.strip()
        # Clean up if markdown wrapper exists
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:-3]
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:-3]
            
        parsed = json.loads(raw_text)
        cases = parsed.get("test_cases", [])
        
        if len(cases) < 5:
            # We could automatically retry here natively, or just warn the frontend.
            pass
            
        return {
            "test_cases": cases,
            "metadata": {
                "latency_sec": round(latency, 2),
                "tokens_used": tokens_used
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Error: {str(e)}")

@app.post("/api/testcases/export")
async def export_testcases(data: ExportRequest):
    if data.format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Title", "Type", "Priority", "Preconditions", "Steps", "Test Data", "Expected Result", "Linked Jira ID"])
        for tc in data.test_cases:
            writer.writerow([
                tc.id, tc.title, tc.type, tc.priority, tc.preconditions,
                "\n".join(tc.steps) if isinstance(tc.steps, list) else tc.steps,
                tc.test_data, tc.expected_result, tc.linked_jira_id
            ])
        md_text = output.getvalue()
        return PlainTextResponse(content=md_text, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=testcases.csv"})
        
    elif data.format == "md":
        md = f"# Test Cases\n\n"
        for tc in data.test_cases:
            md += f"## {tc.id}: {tc.title}\n"
            md += f"- **Linked Jira ID:** {tc.linked_jira_id}\n"
            md += f"- **Type:** {tc.type}\n"
            md += f"- **Priority:** {tc.priority}\n"
            md += f"- **Preconditions:** {tc.preconditions}\n"
            md += f"- **Test Data:** {tc.test_data}\n"
            md += f"- **Expected Result:** {tc.expected_result}\n\n"
            md += f"### Steps:\n"
            if isinstance(tc.steps, list):
                for i, step in enumerate(tc.steps, 1):
                    md += f"{i}. {step}\n"
            md += "\n---\n\n"
        return PlainTextResponse(content=md, media_type="text/markdown", headers={"Content-Disposition": "attachment; filename=testcases.md"})
    
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Use 'csv' or 'md'.")
