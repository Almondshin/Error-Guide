# Reset to the very beginning (root commit) if possible, or just reset the last 6 commits
# Since we want to redo EVERYTHING from scratch:
git update-ref -d HEAD
git add README.md
git commit -m "docs: 프로젝트 개요 및 아키텍처 정의 (README.md)"

git add build.gradle settings.gradle src/main/resources/application.yml src/main/resources/logback-spring.xml .gitignore
git commit -m "chore: 프로젝트 기본 설정 및 인프라 레이어 구축"

git add src/main/java/com/mobileok/identity/domain src/main/java/com/mobileok/identity/application
git commit -m "feat: DDD 기반 도메인 모델 및 핵심 비즈니스 로직(Application Service) 구현"

git add src/main/java/com/mobileok/identity/interfaces src/main/java/com/mobileok/identity/infrastructure src/main/resources/templates src/main/resources/static src/main/resources/docs
git commit -m "feat: REST API 인터페이스 및 관리자 대시보드 UI 구현"git push origin main --force