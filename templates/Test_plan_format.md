Test Plan Template (JIRA-Based)
🔹 1. Test Plan ID & Reference
Test Plan ID: TP-<JIRA_ID> (e.g., TP-JIRA-1234)
JIRA Ticket: <JIRA-1234>
Module: Authentication / Payments / Orders
Prepared By: <Your Name>
Date: <DD-MM-YYYY>
Version: v1.0
🔹 2. Objective

Define what you are testing.

Example:

To validate the functionality, security, and performance of the User Profile API as per JIRA-1234 requirements.

🔹 3. Scope
✅ In Scope
API validation (GET /user/profile)
Authentication & authorization
Response validation
Negative scenarios
❌ Out of Scope
UI testing
Third-party integrations (if not part of ticket)
🔹 4. Requirements Mapping (JIRA)
Requirement ID	Description	Test Case ID
JIRA-1234-1	Fetch user profile	TC-001
JIRA-1234-2	Invalid token handling	TC-002
🔹 5. Test Strategy
🧪 Testing Types
Functional Testing
API Testing (Postman / RestAssured)
Regression Testing
Negative Testing
Security Testing (Auth validation)
🔹 6. Test Scenarios
Scenario ID	Description
TS-01	Valid user profile retrieval
TS-02	Invalid user ID
TS-03	Expired token
TS-04	Missing headers
🔹 7. Test Data
Valid user ID
Invalid user ID
Expired token
Invalid token
🔹 8. Environment Details
Environment: QA / UAT / Staging
Base URL: https://api.test.com
Database: MySQL
Tools: Postman, Selenium, JIRA
🔹 9. Entry & Exit Criteria
✅ Entry Criteria
JIRA ticket is approved
API is deployed in QA
Test data is available
✅ Exit Criteria
All test cases executed
Critical defects closed
Test report shared