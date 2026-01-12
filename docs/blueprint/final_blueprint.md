# Final Master Blueprint: Mobile-OK Identity Verification Service (v3.0-FINAL)

## 1. Automated Data Ingestion (SQL Seed Strategy)
- **Goal:** Transform markdown error codes into a structured PostgreSQL database.
- **Table:** `mok_error_dictionary`
- **Strategy:** Populate the table with error_code, description, customer_message, error_layer, and system_flow_step.
- **Sample Seed:**
  INSERT INTO mok_error_dictionary (error_code, description, customer_message, error_layer, system_flow_step)
  VALUES
  ('4008', 'Connection Failure', '선택하신 본인확인 서비스와 연결에 실패했습니다.', 'INFRASTRUCTURE', 'AUTH_REQUEST'),
  ('5033', 'Token Expired (5s)', '유효시간이 만료되었습니다. 처음부터 다시 시도해 주세요.', 'DOMAIN', 'CONFIRM_REQUEST');

## 2. Transactional State Management (5s TTL & Race Conditions)
- **State Machine (FSM):** - CREATED -> AUTH_REQUESTED -> TOKEN_RECEIVED -> VERIFIED or EXPIRED.
- **Pre-emptive Expiration:** Reject requests internally if the time elapsed since `TOKEN_RECEIVED` is > 4.8 seconds to avoid carrier-side 5033 errors.
- **Concurrency Control:** Use JPA `@Version` (Optimistic Locking) on `clientTxId` to prevent double-processing.

## 3. Detailed Sequence for Error Diagnosis
- **Context Extraction:** Extract `error_code` and `system_flow_step` from raw logs.
- **Similarity Match:** Fuzzy search the Knowledge Base (PostgreSQL) for matching patterns and "Architect's Fix" logic.
- **Output:** Generate a dual-view diagnosis (Architect's technical fix + PM's business impact).

## 4. PII Security & Masking
- **Rules:** - `userName`: F*L (e.g., 홍*동)
    - `userPhone`: 010-****-1234
    - `userBirthday`: 1990-**-**
- **Implementation:** AOP-based masking or Custom Jackson Serializers for log outputs.

## 5. Final Definition of Done (DoD)
- Zero "Critical" issues in SonarQube.
- 100% Unit Test coverage for `MokCryptoService`.
- Successful simulation of the 5s TTL expiration.
- All new error patterns registered in the Knowledge Base.