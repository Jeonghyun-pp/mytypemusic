# 전체 파이프라인 테스트 스크립트
# 사용법: .\test-pipeline.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== 전체 파이프라인 테스트 ===" -ForegroundColor Cyan
Write-Host ""

# 테스트용 토픽
$TEST_TOPIC = "아이브 컴백"
$TEST_KEYWORDS = "아이브,뉴진스,케이팝"
$OUTPUT_DIR = "outputs\test-run"

Write-Host "[1/7] Agent 0: 토픽 요청 생성..." -ForegroundColor Yellow
npx tsx agents/topic-intelligence/cli.ts request --prompt "$TEST_TOPIC"

# Topic ID를 가져오기 위해 마지막 출력에서 추출
# 실제로는 topicId를 파일에서 읽어야 함
Write-Host ""
Write-Host "⚠️  위에서 출력된 Topic ID를 복사해서 다음 명령어에 사용하세요" -ForegroundColor Yellow
Write-Host "예: npx tsx agents/topic-intelligence/cli.ts intel --topicId <TOPIC_ID> --phase A" -ForegroundColor Gray
Write-Host ""
Write-Host "또는 수동으로 다음 단계를 실행하세요:" -ForegroundColor Yellow
Write-Host ""
Write-Host "[2/7] Agent 0: Phase 1-A (RSS 수집)" -ForegroundColor Cyan
Write-Host "  npx tsx agents/topic-intelligence/cli.ts intel --topicId <TOPIC_ID> --phase A" -ForegroundColor Gray
Write-Host ""
Write-Host "[3/7] Agent 0: Phase 1-B (관련성 점수)" -ForegroundColor Cyan
Write-Host "  npx tsx agents/topic-intelligence/cli.ts intel --topicId <TOPIC_ID> --phase B" -ForegroundColor Gray
Write-Host ""
Write-Host "[4/7] Agent 0: Phase 1-C (콘텐츠 필드 생성)" -ForegroundColor Cyan
Write-Host "  npx tsx agents/topic-intelligence/cli.ts intel --topicId <TOPIC_ID> --phase C" -ForegroundColor Gray
Write-Host ""
Write-Host "[5/7] Agent 0: Phase 1-D (패키지 조립)" -ForegroundColor Cyan
Write-Host "  npx tsx agents/topic-intelligence/cli.ts intel --topicId <TOPIC_ID> --phase D" -ForegroundColor Gray
Write-Host ""
Write-Host "[6/7] Agent 0: Bridge to Agent 3" -ForegroundColor Cyan
Write-Host "  npx tsx agents/topic-intelligence/cli.ts bridge-agent2 --topicId <TOPIC_ID>" -ForegroundColor Gray
Write-Host ""
Write-Host "[7/7] Agent 3: Content Structuring" -ForegroundColor Cyan
Write-Host "  npx tsx agents/content-structuring/cli.ts content --topicId <TOPIC_ID>" -ForegroundColor Gray
Write-Host ""
Write-Host "[8/7] Agent 1: 이미지 획득" -ForegroundColor Cyan
Write-Host "  npx tsx agents/safe-image-acquisition/cli.ts --topic `"$TEST_TOPIC`" --keywords `"$TEST_KEYWORDS`" --use editorial --channel instagram --category music --out `"$OUTPUT_DIR`"" -ForegroundColor Gray
Write-Host ""
Write-Host "[9/7] Agent 3: Bridge to Agent 2" -ForegroundColor Cyan
Write-Host "  npx tsx agents/content-structuring/cli.ts bridge --topicId <TOPIC_ID>" -ForegroundColor Gray
Write-Host ""
Write-Host "[10/7] Agent 2: 카드뉴스 구성" -ForegroundColor Cyan
Write-Host "  npx tsx agents/cardnews-composition/cli.ts --mode preflight --input `"$OUTPUT_DIR\validated-post.json`" --out `"$OUTPUT_DIR\agent2`"" -ForegroundColor Gray
Write-Host "  npx tsx agents/cardnews-composition/cli.ts --mode html --input `"$OUTPUT_DIR\validated-post.json`" --topic `"outputs\<TOPIC_ID>\agent2-topic.json`" --out `"$OUTPUT_DIR\agent2`"" -ForegroundColor Gray
Write-Host "  npx tsx agents/cardnews-composition/cli.ts --mode png --out `"$OUTPUT_DIR\agent2`"" -ForegroundColor Gray
Write-Host "  npx tsx agents/cardnews-composition/cli.ts --mode finalize --input `"$OUTPUT_DIR\validated-post.json`" --topic `"outputs\<TOPIC_ID>\agent2-topic.json`" --out `"$OUTPUT_DIR\agent2`"" -ForegroundColor Gray
Write-Host ""
Write-Host "[11/7] Agent 4: Publish Bundle" -ForegroundColor Cyan
Write-Host "  npx tsx agents/publish-bundle/cli.ts scaffold --topicId <TOPIC_ID>" -ForegroundColor Gray
Write-Host "  npx tsx agents/publish-bundle/cli.ts build --topicId <TOPIC_ID>" -ForegroundColor Gray
Write-Host ""
