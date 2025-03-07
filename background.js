// 확장 프로그램이 처음 설치되거나 업데이트될 때 초기화
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.set({ 
    isExtracting: false, 
    extractedItems: [],
    enableAreaSelection: false,
    autoExtractTags: '',
    containerSelector: '',
    processedMessageIds: [], // 처리된 메시지 ID 저장용 필드
    selectorPending: false, // 선택자 처리 대기 상태
    lastSelectedSelector: '', // 마지막 선택된 선택자
    lastSelectionType: '' // 마지막 선택 유형
  });
  
  console.log('Hani Extractor가 설치되었습니다.');
});

// 명령 핸들러 등록
chrome.commands.onCommand.addListener(function(command) {
  console.log('명령 수신:', command);
  
  if (command === 'toggle-extraction') {
    toggleExtraction();
  } else if (command === 'capture-selection') {
    captureSelection();
  }
});

// 브라우저 탭 간의 통신 처리
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background 메시지 수신:', request);
  
  // 이미 처리된 메시지인지 확인하기 위한 ID 처리
  // 원본 메시지에 ID가 없으면 새로 생성
  const messageId = request.messageId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // elementSelectorGenerated 메시지 처리
  if (request.action === 'elementSelectorGenerated') {
    try {
      // 선택된 요소의 선택자를 스토리지에 임시 저장
      console.log('선택자 생성됨:', request.selector, '유형:', request.selectionType);
      
      // 스토리지에 저장하여 팝업이 다시 열렸을 때 사용할 수 있게 함
      chrome.storage.local.set({
        lastSelectedSelector: request.selector,
        lastSelectionType: request.selectionType,
        selectorPending: true // 선택자가 처리 대기 중임을 표시
      }, function() {
        if (chrome.runtime.lastError) {
          console.error('선택자 저장 오류:', chrome.runtime.lastError);
        } else {
          console.log('선택자가 스토리지에 저장됨');
        }
      });
      
      // 열려있는 팝업이 있으면 메시지 전달 시도
      chrome.runtime.sendMessage(request, function(response) {
        if (chrome.runtime.lastError) {
          console.log('팝업이 닫혀있거나 응답하지 않음, 선택자는 스토리지에 저장됨');
        } else {
          console.log('팝업에 선택자 전달됨');
        }
      });
      
      sendResponse({ status: 'selector_saved' });
    } catch (error) {
      console.error('선택자 처리 중 오류:', error);
      sendResponse({ status: 'error', message: error.message });
    }
    return true;
  }
  
  // 이미 처리한 메시지인지 확인하는 함수
  function isMessageProcessed(msgId) {
    return new Promise(resolve => {
      chrome.storage.local.get(['processedMessageIds'], function(result) {
        if (chrome.runtime.lastError) {
          console.error('스토리지 접근 오류:', chrome.runtime.lastError.message);
          resolve(false);
          return;
        }
        
        const processedIds = result.processedMessageIds || [];
        resolve(processedIds.includes(msgId));
      });
    });
  }
  
  // 처리된 메시지 ID를 저장하는 함수
  function saveProcessedMessageId(msgId) {
    chrome.storage.local.get(['processedMessageIds'], function(result) {
      if (chrome.runtime.lastError) {
        console.error('스토리지 접근 오류:', chrome.runtime.lastError.message);
        return;
      }
      
      let processedIds = result.processedMessageIds || [];
      
      // 배열 크기 제한 (최대 100개)
      if (processedIds.length >= 100) {
        processedIds = processedIds.slice(-99); // 가장 오래된 ID 제거
      }
      
      processedIds.push(msgId);
      chrome.storage.local.set({ processedMessageIds: processedIds });
    });
  }
  
  if (request.action === 'ping') {
    // 연결 확인용 핑에 응답
    sendResponse({ status: 'pong' });
    return true;
  }
  
  if (request.action === 'ensureContentScriptLoaded') {
    ensureContentScriptLoaded(request.tabId).then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  // 텍스트 추출 관련 메시지 처리 (bulkTextExtracted, newTextExtracted, extractionError)
  if (request.action === 'newTextExtracted' || request.action === 'bulkTextExtracted' || request.action === 'extractionError') {
    // 메시지 중복 처리 방지 로직 추가
    isMessageProcessed(messageId).then(isProcessed => {
      if (isProcessed) {
        console.log('이미 처리된 메시지입니다. 중복 처리 방지:', messageId);
        sendResponse({ status: 'already-processed' });
        return;
      }
      
      // 메시지 ID 저장 (처리 전에 미리 저장하여 동시 처리 방지)
      saveProcessedMessageId(messageId);
      
      try {
        // 먼저 데이터를 storage에 저장
        if (request.action === 'newTextExtracted') {
          saveExtractedItemToStorage(request.data);
        } else if (request.action === 'bulkTextExtracted') {
          console.log(`처리 중: ${messageId} - 항목 ${request.data.length}개`);
          saveExtractedItemsToStorage(request.data);
        }
        
        // 그 다음 팝업이 열려 있으면 메시지 전달 시도 (메시지 ID 추가)
        const messageToPopup = {
          ...request,
          messageId: messageId // 메시지 ID 전달
        };
        
        chrome.runtime.sendMessage(messageToPopup, function(response) {
          if (chrome.runtime.lastError) {
            // 팝업이 열려 있지 않음 - 오류 무시
            console.log('팝업에 메시지를 전송할 수 없습니다:', chrome.runtime.lastError.message);
          } else {
            console.log('팝업에 메시지 전송됨, 응답:', response);
          }
        });
        
        sendResponse({ status: 'processed' });
      } catch (error) {
        console.error('메시지 처리 중 오류:', error);
        sendResponse({ status: 'error', message: error.message });
      }
    });
    
    return true; // 비동기 응답을 위해 true 반환
  }
  
  return true;
});

// content script가 로드되었는지 확인하고, 필요하면 로드
async function ensureContentScriptLoaded(tabId) {
  try {
    // 먼저 content script가 이미 로드되었는지 확인
    return new Promise(resolve => {
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, function(response) {
        if (chrome.runtime.lastError) {
          console.log('Content script가 로드되지 않았습니다. 로드 시도:', chrome.runtime.lastError.message);
          
          // content script 주입
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }, function() {
            if (chrome.runtime.lastError) {
              console.error('스크립트 주입 실패:', chrome.runtime.lastError.message);
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              console.log('Content script 주입 성공');
              // 스크립트가 로드될 시간을 주기 위해 약간 지연
              setTimeout(() => {
                resolve({ success: true });
              }, 200);
            }
          });
        } else {
          console.log('Content script가 이미 로드되어 있습니다.');
          resolve({ success: true });
        }
      });
    });
  } catch (error) {
    console.error('ContentScript 로드 중 오류:', error);
    return { success: false, error: error.message };
  }
}

// storage에 추출된 항목 저장
function saveExtractedItemToStorage(item) {
  try {
    chrome.storage.local.get(['extractedItems'], function(result) {
      if (chrome.runtime.lastError) {
        console.error('스토리지 접근 오류:', chrome.runtime.lastError.message);
        return;
      }
      
      let items = result.extractedItems || [];
      items.push(item);
      chrome.storage.local.set({ extractedItems: items });
    });
  } catch (error) {
    console.error('스토리지 저장 오류:', error);
  }
}

// storage에 여러 추출된 항목 저장
function saveExtractedItemsToStorage(newItems) {
  try {
    chrome.storage.local.get(['extractedItems'], function(result) {
      if (chrome.runtime.lastError) {
        console.error('스토리지 접근 오류:', chrome.runtime.lastError.message);
        return;
      }
      
      // 데이터 처리 및 저장
      let items = result.extractedItems || [];
      items = [...items, ...newItems];
      
      // 데이터 저장
      chrome.storage.local.set({ extractedItems: items });
      
      console.log('스토리지에 항목 저장 완료:', newItems.length);
    });
  } catch (error) {
    console.error('스토리지 저장 오류:', error);
  }
}

// 확장 프로그램 상태 토글
function toggleExtraction() {
  chrome.storage.local.get(['isExtracting'], function(result) {
    const isCurrentlyExtracting = result.isExtracting || false;
    const newState = !isCurrentlyExtracting;
    
    chrome.storage.local.set({ isExtracting: newState });
    
    // 활성 탭에 상태 변경 알림
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length > 0) {
        ensureContentScriptLoaded(tabs[0].id).then(result => {
          if (result.success) {
            chrome.storage.local.get(['enableAreaSelection'], function(settings) {
              chrome.tabs.sendMessage(tabs[0].id, { 
                action: newState ? 'startExtract' : 'stopExtract',
                enableAreaSelection: settings.enableAreaSelection || false
              }, function(response) {
                if (chrome.runtime.lastError) {
                  console.log('탭과 연결할 수 없습니다:', chrome.runtime.lastError.message);
                } else {
                  console.log('탭 응답:', response);
                }
              });
            });
          } else {
            console.error('Content script를 로드할 수 없습니다:', result.error);
          }
        });
      }
    });
  });
}

// 선택 영역 텍스트 추출
function captureSelection() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs.length > 0) {
      ensureContentScriptLoaded(tabs[0].id).then(result => {
        if (result.success) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'captureSelection' }, function(response) {
            if (chrome.runtime.lastError) {
              console.log('탭과 연결할 수 없습니다:', chrome.runtime.lastError.message);
            } else {
              console.log('탭 응답:', response);
            }
          });
        } else {
          console.error('Content script를 로드할 수 없습니다:', result.error);
        }
      });
    }
  });
}