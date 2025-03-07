let isExtracting = false;
let originalCursor = '';
let isAreaSelectionEnabled = false;
let selectionStartElement = null;
let currentHighlightedElements = [];
// 자동 추출 상태 관리를 위한 변수 추가
let isAutoExtracting = false;

// 요소 선택 모드 관련 변수
let isElementSelectionMode = false;
let elementSelectionType = null;

// 말풍선 요소 생성 및 스타일 정의
let tooltip = null;

function createTooltip() {
  try {
    // 이미 존재하는 말풍선 제거
    if (tooltip) {
      try {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      } catch (removeError) {
        console.error('기존 말풍선 제거 중 오류:', removeError);
      }
      tooltip = null;
    }
    
    // 새 말풍선 생성
    tooltip = document.createElement('div');
    tooltip.id = 'hani-extractor-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 999999;
      max-width: 300px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.4;
    `;
    
    // 기본 위치 설정 (나중에 조정됨)
    tooltip.style.left = '0';
    tooltip.style.top = '0';
    
    // 문서에 추가
    document.body.appendChild(tooltip);
  } catch (error) {
    console.error('말풍선 생성 중 오류:', error);
    tooltip = null;
  }
}

function showTooltip(element, event) {
  try {
    createTooltip();
    
    // 요소 정보 추출
    const elementId = element.id ? `#${element.id}` : '';
    const elementClasses = element.className && typeof element.className === 'string' ? 
      `.${element.className.split(' ').join('.')}` : '';
    const elementTag = element.tagName.toLowerCase();
    
    // 선택자 생성
    let selector = elementTag;
    if (elementId) selector += elementId;
    else if (elementClasses) selector += elementClasses;
    
    // 컨테이너 정보 (상위 요소)
    const parentTag = element.parentElement ? element.parentElement.tagName.toLowerCase() : '';
    const parentId = element.parentElement && element.parentElement.id ? `#${element.parentElement.id}` : '';
    const parentClasses = element.parentElement && element.parentElement.className && 
      typeof element.parentElement.className === 'string' ? 
      `.${element.parentElement.className.split(' ').join('.')}` : '';
    
    let parentSelector = '';
    if (parentTag) {
      parentSelector = parentTag;
      if (parentId) parentSelector += parentId;
      else if (parentClasses) parentSelector += parentClasses;
    }
    
    // 말풍선 내용 설정
    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">요소 정보</div>
      <div>태그: <span style="color: #8be9fd;">${elementTag}</span></div>
      ${elementId ? `<div>ID: <span style="color: #ff79c6;">${elementId.slice(1)}</span></div>` : ''}
      ${elementClasses ? `<div>클래스: <span style="color: #50fa7b;">${elementClasses.slice(1).replace(/\./g, ' ')}</span></div>` : ''}
      <div style="margin-top: 6px; margin-bottom: 4px;"><b>선택자:</b></div>
      <div><code style="background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 2px;">${selector}</code></div>
      ${parentSelector ? `
        <div style="margin-top: 6px; margin-bottom: 4px;"><b>상위 요소:</b></div>
        <div><code style="background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 2px;">${parentSelector}</code></div>
      ` : ''}
    `;
    
    // x, y 좌표 확보 전에 보이지 않게 설정
    tooltip.style.opacity = '0';
    
    // 브라우저가 레이아웃을 계산할 시간을 주기 위해 setTimeout 사용
    setTimeout(() => {
      try {
        // 말풍선 위치 설정 (마우스 위치 기준)
        const x = event.clientX;
        const y = event.clientY;
        
        // 화면 경계 확인
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // x 좌표 조정 (오른쪽 경계 초과 시)
        let posX = x + 15;
        if (posX + tooltipRect.width > viewportWidth) {
          posX = x - tooltipRect.width - 15;
        }
        
        // y 좌표 조정 (하단 경계 초과 시)
        let posY = y + 15;
        if (posY + tooltipRect.height > viewportHeight) {
          posY = y - tooltipRect.height - 15;
        }
        
        tooltip.style.left = `${posX}px`;
        tooltip.style.top = `${posY}px`;
        tooltip.style.opacity = '1';
      } catch (positionError) {
        console.error('말풍선 위치 설정 중 오류:', positionError);
      }
    }, 0);
  } catch (error) {
    console.error('말풍선 표시 중 오류:', error);
    
    // 말풍선 생성 실패 시 정리
    if (tooltip) {
      try {
        removeTooltip();
      } catch (cleanupError) {
        console.error('말풍선 정리 중 오류:', cleanupError);
      }
    }
  }
}

function hideTooltip() {
  if (tooltip) {
    tooltip.style.opacity = '0';
  }
}

function removeTooltip() {
  if (tooltip && tooltip.parentNode) {
    tooltip.parentNode.removeChild(tooltip);
    tooltip = null;
  }
}

// 안전한 메시지 전송 함수
function safeSendMessage(message) {
  try {
    // 메시지 ID 생성 (중복 방지)
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 메시지에 ID 추가
    const messageWithId = {
      ...message,
      messageId: messageId
    };
    
    // 메시지를 잠시 저장할 로컬 저장소 (로컬 스토리지는 사용 불가)
    if (!window.sentMessageIds) {
      window.sentMessageIds = new Set();
    }
    
    // 이미 전송한 메시지인지 확인
    if (window.sentMessageIds.has(messageId)) {
      console.log('이미 전송한 메시지입니다. 중복 전송 방지:', messageId);
      return;
    }
    
    // 전송한 메시지 ID 저장
    window.sentMessageIds.add(messageId);
    
    // 너무 많은 메시지 ID가 쌓이는 것을 방지
    if (window.sentMessageIds.size > 100) {
      // 단순 구현: 모두 삭제
      window.sentMessageIds.clear();
    }
    
    // 먼저 background 스크립트가 있는지 확인
    chrome.runtime.sendMessage({ action: 'ping' }, function(response) {
      if (chrome.runtime.lastError) {
        console.log('background에 연결할 수 없습니다. 데이터를 직접 storage에 저장합니다.');
        
        // 추출된 데이터를 직접 storage에 저장
        if (messageWithId.action === 'newTextExtracted') {
          saveExtractedItemToStorage(messageWithId.data);
        } else if (messageWithId.action === 'bulkTextExtracted') {
          saveExtractedItemsToStorage(messageWithId.data);
        }
        
        return;
      }
      
      // background가 응답하면 메시지 전송
      chrome.runtime.sendMessage(messageWithId, function(response) {
        if (chrome.runtime.lastError) {
          console.log('메시지 전송 중 오류:', chrome.runtime.lastError.message);
          
          // 실패 시 직접 storage에 저장
          if (messageWithId.action === 'newTextExtracted') {
            saveExtractedItemToStorage(messageWithId.data);
          } else if (messageWithId.action === 'bulkTextExtracted') {
            saveExtractedItemsToStorage(messageWithId.data);
          }
        }
      });
    });
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.');
      cleanupResources();
    } else {
      console.error('메시지 전송 중 오류:', error);
      
      // 예외 발생 시 직접 storage에 저장
      if (message.action === 'newTextExtracted') {
        saveExtractedItemToStorage(message.data);
      } else if (message.action === 'bulkTextExtracted') {
        saveExtractedItemsToStorage(message.data);
      }
    }
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
      
      let items = result.extractedItems || [];
      items = [...items, ...newItems];
      chrome.storage.local.set({ extractedItems: items });
    });
  } catch (error) {
    console.error('스토리지 저장 오류:', error);
  }
}

// 리소스 정리 함수
function cleanupResources() {
  try {
    // 이벤트 리스너 제거
    document.removeEventListener('click', handleElementClick, true);
    document.removeEventListener('mousedown', handleSelectionStart, true);
    document.removeEventListener('mouseup', handleSelectionEnd, true);
    
    // 요소 선택 모드 정리
    if (isElementSelectionMode) {
      cleanupElementSelection();
    }
    
    // 하이라이트 제거
    clearHighlights();
    
    // 말풍선 제거
    removeTooltip();
    
    // 커서 복원
    document.body.style.cursor = originalCursor;
    
    // 상태 변수 초기화
    isExtracting = false;
    isAreaSelectionEnabled = false;
    selectionStartElement = null;
    isAutoExtracting = false;
  } catch (e) {
    console.log('리소스 정리 중 오류:', e);
  }
}

// 컨텍스트 무효화 오류 처리를 위한 try-catch 래퍼
function tryCatchWrapper(fn) {
  return function(...args) {
    try {
      return fn.apply(this, args);
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.log('확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.');
        cleanupResources();
      } else {
        console.error('함수 실행 중 오류:', error);
      }
    }
  };
}

// 전역 오류 처리기
window.addEventListener('error', function(event) {
  if (event.error && event.error.message && event.error.message.includes('Extension context invalidated')) {
    console.log('확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.');
    cleanupResources();
    event.preventDefault(); // 브라우저 콘솔에 오류 표시 방지
  }
});

// 메시지 리스너 설정
try {
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Content script 메시지 수신:', request);
    
    try {
      if (request.action === 'ping') {
        // 연결 확인용 핑
        sendResponse({ status: 'pong' });
} else if (request.action === 'startExtract') {
        isAreaSelectionEnabled = request.enableAreaSelection || false;
        startExtraction();
        sendResponse({ status: 'started' });
      } else if (request.action === 'stopExtract') {
        stopExtraction();
        sendResponse({ status: 'stopped' });
      } else if (request.action === 'updateSettings') {
        isAreaSelectionEnabled = request.enableAreaSelection || false;
        sendResponse({ status: 'updated' });
      } else if (request.action === 'autoExtract') {
        autoExtractText(request.tags, request.container);
        sendResponse({ status: 'extracting' });
      } else if (request.action === 'captureSelection') {
        captureSelection();
        sendResponse({ status: 'capturing' });
      } else if (request.action === 'startElementSelection') {
        startElementSelection(request.selectionType);
        sendResponse({ status: 'started' });
      }
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.log('확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.');
        cleanupResources();
      } else {
        console.error('메시지 처리 중 오류:', error);
        sendResponse({ status: 'error', message: error.message });
      }
    }
    
    return true; // 비동기 응답을 위해 true 반환
  });
} catch (error) {
  console.error('메시지 리스너 설정 중 오류:', error);
}

// 페이지 로드 시 확장 프로그램 상태 확인
try {
  chrome.storage.local.get(['isExtracting', 'enableAreaSelection'], function(result) {
    // runtime.lastError 체크
    if (chrome.runtime.lastError) {
      console.error('스토리지 접근 오류:', chrome.runtime.lastError.message);
      return;
    }
    
    if (result.isExtracting) {
      isAreaSelectionEnabled = result.enableAreaSelection || false;
      startExtraction();
    }
  });
} catch (error) {
  console.error('스토리지 접근 중 오류:', error);
}

function startExtraction() {
  try {
    isExtracting = true;
    
    // 커서 스타일 저장 및 변경
    originalCursor = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';
    
    // 클릭 이벤트 리스너 추가
    document.addEventListener('click', handleElementClick, true);
    
    // 영역 선택 이벤트 리스너 추가 (활성화된 경우)
    if (isAreaSelectionEnabled) {
      document.addEventListener('mousedown', handleSelectionStart, true);
      document.addEventListener('mouseup', handleSelectionEnd, true);
    }
    
    // 말풍선 생성
    createTooltip();
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.');
      cleanupResources();
    } else {
      console.error('startExtraction 중 오류:', error);
    }
  }
}

function stopExtraction() {
  try {
    isExtracting = false;
    
    // 커서 스타일 복원
    document.body.style.cursor = originalCursor;
    
    // 이벤트 리스너 제거
    document.removeEventListener('click', handleElementClick, true);
    document.removeEventListener('mousedown', handleSelectionStart, true);
    document.removeEventListener('mouseup', handleSelectionEnd, true);
    
    // 영역 선택 하이라이트 제거
    clearHighlights();
    
    // 말풍선 제거
    removeTooltip();
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.');
    } else {
      console.error('stopExtraction 중 오류:', error);
    }
  }
}

function handleElementClick(event) {
  try {
    if (!isExtracting) return;
    
    // 요소 선택 모드가 활성화된 경우 일반 클릭 무시
    if (isElementSelectionMode) return;
    
    // Shift 키가 눌려있고 영역 선택이 활성화된 경우 클릭 무시
    if (event.shiftKey && isAreaSelectionEnabled) return;
    
    // 이벤트 기본 동작 방지
    event.preventDefault();
    event.stopPropagation();
    
    const clickedElement = event.target;
    
    try {
      // 말풍선 표시 시도 (독립적으로 동작)
      showTooltip(clickedElement, event);
      
      // 5초 후 말풍선 숨기기
      setTimeout(hideTooltip, 5000);
    } catch (tooltipError) {
      console.error('말풍선 표시 중 오류:', tooltipError);
      // 말풍선 오류가 발생해도 계속 진행
    }
    
    // 텍스트 추출 시도 (독립적으로 동작)
    try {
      extractElementText(clickedElement);
    } catch (extractError) {
      console.error('텍스트 추출 중 오류:', extractError);
    }
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.');
      cleanupResources();
    } else {
      console.error('handleElementClick 중 오류:', error);
    }
  }
}

function extractElementText(element) {
  try {
    // 요소 정보 추출
    const elementId = element.id ? `#${element.id}` : '';
    const elementClasses = element.className && typeof element.className === 'string' ? 
      `.${element.className.split(' ').join('.')}` : '';
    const elementTag = element.tagName.toLowerCase();
    
    // 요소 정보 문자열 생성
    let elementInfo = elementTag;
    if (elementId) elementInfo += elementId;
    if (elementClasses) elementInfo += elementClasses;
    
    // 텍스트 추출
    const extractedText = element.innerText.trim();
    
    if (extractedText) {
      // 확장 프로그램에 추출된 텍스트 전송
      safeSendMessage({
        action: 'newTextExtracted',
        data: {
          elementInfo: elementInfo,
          text: extractedText,
          tagName: elementTag
        }
      });
      
      // 사용자에게 피드백 제공
      showFeedback(element);
      return true;
    }
    
    return false;
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.');
      cleanupResources();
    } else {
      console.error('extractElementText 중 오류:', error);
    }
    return false;
  }
}
function showFeedback(element) {
  try {
    // 요소 주변에 피드백 효과 표시
    const originalOutline = element.style.outline;
    const originalTransition = element.style.transition;
    
    element.style.transition = 'outline 0.3s ease-in-out';
    element.style.outline = '2px solid #4285f4';
    
    setTimeout(() => {
      try {
        element.style.outline = originalOutline;
        element.style.transition = originalTransition;
      } catch (e) {
        console.log('피드백 복원 중 오류:', e);
      }
    }, 500);
  } catch (error) {
    console.error('showFeedback 중 오류:', error);
  }
}

// 영역 선택 기능 구현
function handleSelectionStart(event) {
  try {
    if (!isExtracting || !isAreaSelectionEnabled || !event.shiftKey) return;
    
    // 이벤트 기본 동작 방지
    event.preventDefault();
    event.stopPropagation();
    
    // 선택 시작 요소 저장
    selectionStartElement = event.target;
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.');
      cleanupResources();
    } else {
      console.error('handleSelectionStart 중 오류:', error);
    }
  }
}

function handleSelectionEnd(event) {
  try {
    if (!isExtracting || !isAreaSelectionEnabled || !event.shiftKey || !selectionStartElement) return;
    
    // 이벤트 기본 동작 방지
    event.preventDefault();
    event.stopPropagation();
    
    const endElement = event.target;
    
    // 시작과 끝 요소가 다른 경우에만 처리
    if (selectionStartElement !== endElement) {
      const elements = findElementsBetween(selectionStartElement, endElement);
      extractElementsText(elements);
    }
    
    // 선택 초기화
    selectionStartElement = null;
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.');
      cleanupResources();
    } else {
      console.error('handleSelectionEnd 중 오류:', error);
    }
  }
}

function findElementsBetween(startEl, endEl) {
  try {
    // 모든 텍스트를 포함하는 요소 찾기
    const textElements = Array.from(document.querySelectorAll('*')).filter(el => {
      const text = el.innerText.trim();
      return text.length > 0 && !el.contains(startEl) && !el.contains(endEl);
    });
    
    // 시작 요소와 끝 요소의 위치 가져오기
    const startRect = startEl.getBoundingClientRect();
    const endRect = endEl.getBoundingClientRect();
    
    // 선택 영역의 범위 계산
    const selectionBox = {
      top: Math.min(startRect.top, endRect.top),
      right: Math.max(startRect.right, endRect.right),
      bottom: Math.max(startRect.bottom, endRect.bottom),
      left: Math.min(startRect.left, endRect.left)
    };
    
    // 선택 영역 내에 있는 요소들만 필터링
    return [startEl, ...textElements.filter(el => {
      const rect = el.getBoundingClientRect();
      return (
        rect.top >= selectionBox.top &&
        rect.right <= selectionBox.right &&
        rect.bottom <= selectionBox.bottom &&
        rect.left >= selectionBox.left
      );
    }), endEl];
  } catch (error) {
    console.error('findElementsBetween 중 오류:', error);
    return [startEl, endEl];
  }
}

function extractElementsText(elements) {
  try {
    const extractedData = [];
    
    // 하이라이트 제거
    clearHighlights();
    
    // 각 요소 처리
    elements.forEach(element => {
      try {
        // 요소 정보 추출
        const elementId = element.id ? `#${element.id}` : '';
        const elementClasses = element.className && typeof element.className === 'string' ? 
          `.${element.className.split(' ').join('.')}` : '';
        const elementTag = element.tagName.toLowerCase();
        
        // 요소 정보 문자열 생성
        let elementInfo = elementTag;
        if (elementId) elementInfo += elementId;
        if (elementClasses) elementInfo += elementClasses;
        
        // 텍스트 추출
        const extractedText = element.innerText.trim();
        
        if (extractedText) {
          extractedData.push({
            elementInfo: elementInfo,
            text: extractedText,
            tagName: elementTag
          });
          
          // 하이라이트 표시
          highlightElement(element);
        }
      } catch (elementError) {
        console.error('요소 처리 중 오류:', elementError);
      }
    });
    
    if (extractedData.length > 0) {
      // 확장 프로그램에 추출된 텍스트 전송
      safeSendMessage({
        action: 'bulkTextExtracted',
        data: extractedData
      });
    }
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.');
      cleanupResources();
    } else {
      console.error('extractElementsText 중 오류:', error);
    }
  }
}

function highlightElement(element) {
  try {
    const originalOutline = element.style.outline;
    const originalZIndex = element.style.zIndex;
    const originalPosition = element.style.position;
    
    element.style.outline = '2px dashed #4285f4';
    element.style.zIndex = '9999';
    if (originalPosition === 'static') {
      element.style.position = 'relative';
    }
    
    currentHighlightedElements.push({
      element: element,
      originalOutline: originalOutline,
      originalZIndex: originalZIndex,
      originalPosition: originalPosition
    });
  } catch (error) {
    console.error('highlightElement 중 오류:', error);
  }
}

function clearHighlights() {
  try {
    currentHighlightedElements.forEach(item => {
      try {
        item.element.style.outline = item.originalOutline;
        item.element.style.zIndex = item.originalZIndex;
        item.element.style.position = item.originalPosition;
      } catch (elementError) {
        console.log('요소 하이라이트 제거 중 오류:', elementError);
      }
    });
    
    currentHighlightedElements = [];
  } catch (error) {
    console.error('clearHighlights 중 오류:', error);
  }
}

// 현재 선택된 텍스트 추출
function captureSelection() {
  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      safeSendMessage({
        action: 'extractionError',
        data: {
          message: '선택된 텍스트가 없습니다. 텍스트를 드래그하여 선택해주세요.'
        }
      });
      return;
    }
    
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === 3 ? container.parentNode : container;
    
    // 요소 정보 추출
    const elementId = element.id ? `#${element.id}` : '';
    const elementClasses = element.className && typeof element.className === 'string' ? 
      `.${element.className.split(' ').join('.')}` : '';
    const elementTag = element.tagName.toLowerCase();
    
    // 요소 정보 문자열 생성
    let elementInfo = elementTag;
    if (elementId) elementInfo += elementId;
    if (elementClasses) elementInfo += elementClasses;
    
    // 텍스트 추출
    const extractedText = selection.toString().trim();
    
    if (extractedText) {
      safeSendMessage({
        action: 'newTextExtracted',
        data: {
          elementInfo: elementInfo + " (선택 영역)",
          text: extractedText,
          tagName: elementTag
        }
      });
      
      showFeedback(element);
    }
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.');
      cleanupResources();
    } else {
      console.error('captureSelection 중 오류:', error);
    }
  }
}

// 자동 추출 기능
function autoExtractText(tagsString, containerString) {
  // 이미 추출 중이면 중복 실행 방지
  if (isAutoExtracting) {
    console.log('자동 추출이 이미 진행 중입니다.');
    return;
  }
  
  try {
    if (!tagsString && !containerString) return;
    
    // 추출 상태 설정
    isAutoExtracting = true;
    
    const extractedElements = [];
    const processedTexts = new Set(); // 중복 텍스트 방지를 위한 Set 추가
    
    try {
      if (containerString) {
        // 컨테이너 내 모든 텍스트 요소 추출
        const containers = document.querySelectorAll(containerString);
        
        containers.forEach(container => {
          // 컨테이너 내의 텍스트를 포함하는 모든 요소
          const textElements = Array.from(container.querySelectorAll('*')).filter(el => {
            const text = el.innerText.trim();
            return text.length > 0 && !Array.from(el.children).some(child => child.innerText.trim().length > 0);
          });
          
          textElements.forEach(element => {
            if (!extractedElements.includes(element)) {
              extractedElements.push(element);
            }
          });
        });
      }
      
      if (tagsString) {
        // 특정 태그/클래스/ID 선택자에 해당하는 요소 추출
        const selectors = tagsString.split(',').map(s => s.trim()).filter(s => s.length > 0);
        
        selectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
              if (!extractedElements.includes(element)) {
                extractedElements.push(element);
              }
            });
          } catch (selectorError) {
            console.error('선택자 오류:', selector, selectorError);
          }
        });
      }
      
      // 중복 제거
      const uniqueElements = Array.from(new Set(extractedElements));
      
      // 텍스트 추출 및 전송
      const extractedData = [];
      
      uniqueElements.forEach(element => {
        try {
          // 요소 정보 추출
          const elementId = element.id ? `#${element.id}` : '';
          const elementClasses = element.className && typeof element.className === 'string' ? 
            `.${element.className.split(' ').join('.')}` : '';
          const elementTag = element.tagName.toLowerCase();
          
          // 요소 정보 문자열 생성
          let elementInfo = elementTag;
          if (elementId) elementInfo += elementId;
          if (elementClasses) elementInfo += elementClasses;
          
          // 텍스트 추출
          const extractedText = element.innerText.trim();
          
          // 중복 체크 추가
          if (extractedText && !processedTexts.has(extractedText)) {
            // 중복 방지를 위해 Set에 추가
            processedTexts.add(extractedText);
            
            extractedData.push({
              elementInfo: elementInfo,
              text: extractedText,
              tagName: elementTag
            });
            
            // 피드백 표시
            showFeedback(element);
          }
        } catch (elementError) {
          console.error('요소 처리 중 오류:', elementError);
        }
      });
      
      if (extractedData.length > 0) {
        // 로그 추가
        console.log(`${extractedData.length}개 항목 추출 완료, 메시지 전송 중...`);
        
        // 확장 프로그램에 추출된 텍스트 전송 (한 번만)
        safeSendMessage({
          action: 'bulkTextExtracted',
          data: extractedData
        });
      } else {
        safeSendMessage({
          action: 'extractionError',
          data: {
            message: '지정한 선택자에 해당하는 요소를 찾을 수 없거나 텍스트가 없습니다.'
          }
        });
      }
    } catch (innerError) {
      console.error('자동 추출 내부 오류:', innerError);
      
      // 오류 알림
      safeSendMessage({
        action: 'extractionError',
        data: {
          message: '자동 추출 중 오류가 발생했습니다: ' + innerError.message
        }
      });
    } finally {
      // 작업 완료 후 상태 초기화
      setTimeout(() => {
        isAutoExtracting = false;
        console.log('자동 추출 상태 초기화 완료');
      }, 1000); // 재실행 방지를 위해 약간의 지연 추가
    }
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.');
      cleanupResources();
    } else {
      console.error('autoExtractText 중 오류:', error);
      
      // 오류 알림
      try {
        safeSendMessage({
          action: 'extractionError',
          data: {
            message: '자동 추출 중 오류가 발생했습니다: ' + error.message
          }
        });
      } catch (sendError) {
        console.error('오류 메시지 전송 실패:', sendError);
      }
    }
    
    // 오류 발생 시에도 상태 초기화
    isAutoExtracting = false;
  }
}

// 요소 선택 모드 시작 함수
function startElementSelection(selectionType) {
  try {
    isElementSelectionMode = true;
    elementSelectionType = selectionType;
    
    // 원래 커서 저장 및 변경
    originalCursor = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';
    
    // 한 번만 클릭 이벤트를 처리하는 함수 추가
    document.addEventListener('click', handleSelectorElementClick, true);
    
    // 작업을 중단할 수 있도록 ESC 키 이벤트 추가
    document.addEventListener('keydown', handleSelectionKeydown, true);
  } catch (error) {
    console.error('startElementSelection 중 오류:', error);
    cleanupElementSelection();
  }
}

// 선택 모드에서의 키 이벤트 처리
function handleSelectionKeydown(event) {
  // ESC 키를 누르면 선택 모드 종료
  if (event.key === 'Escape' && isElementSelectionMode) {
    event.preventDefault();
    event.stopPropagation();
    cleanupElementSelection();
  }
}

// 요소 클릭 처리 함수 (선택자 생성용)
function handleSelectorElementClick(event) {
  try {
    if (!isElementSelectionMode) return;
    
    // 이벤트 기본 동작 방지
    event.preventDefault();
    event.stopPropagation();
    
    // 클릭된 요소
    const clickedElement = event.target;
    
    // 선택된 요소에서 최적의 선택자 생성
    const selector = generateOptimalSelector(clickedElement, elementSelectionType);
    console.log('생성된 선택자:', selector, '유형:', elementSelectionType);
    
    // 요소 정보 팝업 표시
    try {
      showTooltip(clickedElement, event);
      
      // 3초 후 말풍선 숨기기
      setTimeout(hideTooltip, 3000);
    } catch (tooltipError) {
      console.error('말풍선 표시 중 오류:', tooltipError);
    }
    
    // 선택자를 background로 전송 (팝업이 닫혀있을 수 있으므로)
    chrome.runtime.sendMessage({
      action: 'elementSelectorGenerated',
      selectionType: elementSelectionType,
      selector: selector
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.log('메시지 전송 중 오류:', chrome.runtime.lastError.message);
      } else {
        console.log('선택자가 백그라운드로 전송됨', response);
      }
    });
    
    // 피드백 제공
    showFeedback(clickedElement);
    
    // 알림 표시
    const message = elementSelectionType === 'tag' ? 
      '태그 선택자로 추가되었습니다. 팝업 창을 다시 열어주세요.' : 
      '컨테이너 선택자로 추가되었습니다. 팝업 창을 다시 열어주세요.';
    
    // 화면 상단에 간단한 알림 표시
    showNotification(message);
    
    // 선택 모드 종료
    cleanupElementSelection();
  } catch (error) {
    console.error('handleSelectorElementClick 중 오류:', error);
    cleanupElementSelection();
  }
}

// 화면에 알림 표시 함수
function showNotification(message) {
  try {
    // 이미 존재하는 알림 제거
    const existingNotification = document.getElementById('hani-extractor-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    // 새 알림 생성
    const notification = document.createElement('div');
    notification.id = 'hani-extractor-notification';
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #4285f4;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      text-align: center;
    `;
    
    notification.textContent = message;
    
    // 문서에 추가
    document.body.appendChild(notification);
    
    // 5초 후 제거
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  } catch (error) {
    console.error('알림 표시 중 오류:', error);
  }
}

// 선택 모드 정리 함수
function cleanupElementSelection() {
  try {
    // 이벤트 리스너 제거
    document.removeEventListener('click', handleSelectorElementClick, true);
    document.removeEventListener('keydown', handleSelectionKeydown, true);
    
    // 커서 복원
    document.body.style.cursor = originalCursor;
    
// 상태 변수 초기화
    isElementSelectionMode = false;
    elementSelectionType = null;
  } catch (error) {
    console.error('cleanupElementSelection 중 오류:', error);
  }
}

// 최적의 CSS 선택자 생성 함수
function generateOptimalSelector(element, type) {
  try {
    // 요소의 기본 정보 추출
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className && typeof element.className === 'string' 
      ? Array.from(element.classList).filter(c => c).map(c => `.${c}`).join('')
      : '';
    
    // 기본 선택자 구성
    let selector = tagName;
    
    // ID가 있으면 ID 기반 선택자 생성 (가장 구체적이고 선호됨)
    if (id) {
      selector = type === 'tag' ? `${tagName}${id}` : id;
      return selector;
    }
    
    // 클래스가 있으면 클래스 기반 선택자 생성
    if (classes) {
      if (type === 'tag') {
        // 태그 모드에서는 태그명과 클래스를 조합
        selector = `${tagName}${classes}`;
      } else {
        // 첫번째 클래스만 사용 (더 간단한 선택자)
        const firstClass = element.classList[0];
        if (firstClass) {
          selector = `.${firstClass}`;
        }
      }
      return selector;
    }
    
    // ID나 클래스가 없는 경우, 계층 구조 활용
    if (!id && !classes) {
      // 부모 요소에 ID나 의미 있는 클래스가 있는지 확인
      let parent = element.parentElement;
      let depth = 0;
      const maxDepth = 2; // 최대 2단계까지만 올라가기
      
      while (parent && depth < maxDepth) {
        const parentId = parent.id ? `#${parent.id}` : '';
        const parentTag = parent.tagName.toLowerCase();
        
        if (parentId) {
          // 부모에 ID가 있으면 그것을 기준으로 선택자 생성
          selector = `${parentId} > ${selector}`;
          break;
        } else if (parent.classList && parent.classList.length > 0) {
          // 부모에 클래스가 있으면 첫번째 클래스 사용
          const parentClass = `.${parent.classList[0]}`;
          selector = `${parentTag}${parentClass} > ${selector}`;
          break;
        }
        
        // 부모로 올라가기
        parent = parent.parentElement;
        depth++;
      }
    }
    
    return selector;
  } catch (error) {
    console.error('generateOptimalSelector 중 오류:', error);
    // 오류 발생 시 기본 선택자 반환
    return element.tagName.toLowerCase();
  }
}