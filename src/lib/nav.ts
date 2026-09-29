// 앱 안에서 이동한 기록이 있는지 추적한다. 딥링크로 바로 들어온 경우 뒤로가기는 fallback 경로로 보낸다.
let inAppNavigations = 0;
export function markNavigation() {
  inAppNavigations += 1;
}
export function canGoBack() {
  return inAppNavigations > 1;
}
