// 탭으로 메시지를 안전하게 보내는 유틸리티 함수
function sendMessageToTab(tabId, message, maxRetries = 3) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const tryConnect = () => {
      attempts++;
      
      try {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            console.log(`연결 시도 ${attempts}/${maxRetries} 실패:`, chrome.runtime.lastError.message);
            
            if (attempts < maxRetries) {
              // 연결 재시도 전 짧은 지연
              setTimeout(tryConnect, 300);
            } else {
              console.log(`${maxRetries}회 시도 후 연결 실패, 계속 진행합니다.`);
              resolve(null); // 오류를 거부하지 않고 null로 해결
            }
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        console.error('메시지 전송 중 예외 발생:', error);
        if (attempts < maxRetries) {
          setTimeout(tryConnect, 300);
        } else {
          console.log(`${maxRetries}회 시도 후 연결 실패, 계속 진행합니다.`);
          resolve(null); // 오류를 거부하지 않고 null로 해결
        }
      }
    };
    
    tryConnect();
  });
}

// 런타임으로 메시지를 안전하게 보내는 유틸리티 함수
function sendRuntimeMessage(message, maxRetries = 3) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const tryConnect = () => {
      attempts++;
      
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.log(`런타임 연결 시도 ${attempts}/${maxRetries} 실패:`, chrome.runtime.lastError.message);
            
            if (attempts < maxRetries) {
              // 연결 재시도 전 짧은 지연
              setTimeout(tryConnect, 300);
            } else {
              console.log(`${maxRetries}회 시도 후 런타임 연결 실패, 계속 진행합니다.`);
              resolve(null); // 오류를 거부하지 않고 null로 해결
            }
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        console.error('런타임 메시지 전송 중 예외 발생:', error);
        if (attempts < maxRetries) {
          setTimeout(tryConnect, 300);
        } else {
          console.log(`${maxRetries}회 시도 후 런타임 연결 실패, 계속 진행합니다.`);
          resolve(null); // 오류를 거부하지 않고 null로 해결
        }
      }
    };
    
    tryConnect();
  });
}