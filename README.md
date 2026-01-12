# Error-Guide (MOK 본인확인 에러 가이드 시스템)

## 🛠 기술 스택 (Tech Stack)
- **Language**: Java 17
- **Framework**: Spring Boot 3.x
- **Database**: MariaDB
- **ORM**: JPA (Hibernate)
- **Architecture**: DDD (Domain-Driven Design) Layered Architecture

## 💎 핵심 가치 (Core Value)
본 프로젝트는 본인확인 서비스에서 발생하는 에러 로그를 분석하여 기술 지원을 자동화하고, 해결 사례를 지식 자산화(Knowledge Assetization)하는 것을 목표로 합니다.
- **실시간 진단**: 에러 코드와 로그를 기반으로 AI(Gemini)가 원인을 분석.
- **지식 축적**: 해결된 사례를 DB에 저장하여 향후 유사 건 발생 시 신속 대응.

## 🏗 아키텍처 구조 (Architecture)
DDD 원칙에 따라 4계층으로 분리되어 있습니다.

### 1. Interfaces (Presentation Layer)
- 외부 요청을 처리하는 컨트롤러(`Controller`)와 DTO가 위치합니다.
- 사용자에게 보여지는 웹 페이지(`View`)와 REST API 엔드포인트를 제공합니다.

### 2. Application (Service Layer)
- 비즈니스 유스케이스를 정의하고 흐름을 제어합니다.
- `DiagnosticService` 등 주요 로직이 이곳에서 도메인 객체를 조율합니다.

### 3. Domain (Business Layer)
- 핵심 비즈니스 로직과 엔티티(`Entity`)가 위치합니다.
- `ResolutionCase`, `DiagnosticHistory` 등 데이터의 상태와 행위를 정의합니다.

### 4. Infrastructure (Infrastructure Layer)
- DB, 외부 API(Gemini), 로깅 등 기술적 구현체가 위치합니다.
- `Repository` 구현체, `GeminiApiClient` 등이 포함됩니다.

## ⚙️ 환경 변수 설정 (Environment Variables)
보안을 위해 API Key는 환경 변수로 관리됩니다. 프로젝트 실행 전 반드시 설정이 필요합니다.

### GEMINI_API_KEY
Google Gemini API 사용을 위한 키입니다.

**설정 방법 (IntelliJ / Eclipse):**
Run Configuration -> Environment variables에 추가:
`GEMINI_API_KEY=your_actual_api_key_here`

**설정 방법 (OS 환경 변수):**
```bash
export GEMINI_API_KEY=your_actual_api_key_here
```
