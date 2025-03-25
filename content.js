let isExtracting = false;
let originalCursor = "";
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
        console.error("기존 말풍선 제거 중 오류:", removeError);
      }
      tooltip = null;
    }

    // 새 말풍선 생성
    tooltip = document.createElement("div");
    tooltip.id = "hani-extractor-tooltip";
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
    tooltip.style.left = "0";
    tooltip.style.top = "0";

    // 문서에 추가
    document.body.appendChild(tooltip);
  } catch (error) {
    console.error("말풍선 생성 중 오류:", error);
    tooltip = null;
  }
}

function showTooltip(element, event) {
  try {
    createTooltip();

    // 요소 정보 추출
    const elementId = element.id ? `#${element.id}` : "";
    const elementClasses =
      element.className && typeof element.className === "string"
        ? `.${element.className.split(" ").join(".")}`
        : "";
    const elementTag = element.tagName.toLowerCase();

    // 선택자 생성
    let selector = elementTag;
    if (elementId) selector += elementId;
    else if (elementClasses) selector += elementClasses;

    // 컨테이너 정보 (상위 요소)
    const parentTag = element.parentElement
      ? element.parentElement.tagName.toLowerCase()
      : "";
    const parentId =
      element.parentElement && element.parentElement.id
        ? `#${element.parentElement.id}`
        : "";
    const parentClasses =
      element.parentElement &&
      element.parentElement.className &&
      typeof element.parentElement.className === "string"
        ? `.${element.parentElement.className.split(" ").join(".")}`
        : "";

    let parentSelector = "";
    if (parentTag) {
      parentSelector = parentTag;
      if (parentId) parentSelector += parentId;
      else if (parentClasses) parentSelector += parentClasses;
    }

    // 말풍선 내용 설정
    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">요소 정보</div>
      <div>태그: <span style="color: #8be9fd;">${elementTag}</span></div>
      ${elementId ? `<div>ID: <span style="color: #ff79c6;">${elementId.slice(1)}</span></div>` : ""}
      ${elementClasses ? `<div>클래스: <span style="color: #50fa7b;">${elementClasses.slice(1).replace(/\./g, " ")}</span></div>` : ""}
      <div style="margin-top: 6px; margin-bottom: 4px;"><b>선택자:</b></div>
      <div><code style="background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 2px;">${selector}</code></div>
      ${
        parentSelector
          ? `
        <div style="margin-top: 6px; margin-bottom: 4px;"><b>상위 요소:</b></div>
        <div><code style="background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 2px;">${parentSelector}</code></div>
      `
          : ""
      }
    `;

    // x, y 좌표 확보 전에 보이지 않게 설정
    tooltip.style.opacity = "0";

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
        tooltip.style.opacity = "1";
      } catch (positionError) {
        console.error("말풍선 위치 설정 중 오류:", positionError);
      }
    }, 0);
  } catch (error) {
    console.error("말풍선 표시 중 오류:", error);

    // 말풍선 생성 실패 시 정리
    if (tooltip) {
      try {
        removeTooltip();
      } catch (cleanupError) {
        console.error("말풍선 정리 중 오류:", cleanupError);
      }
    }
  }
}

function hideTooltip() {
  if (tooltip) {
    tooltip.style.opacity = "0";
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
      messageId: messageId,
    };

    // 메시지를 잠시 저장할 로컬 저장소 (로컬 스토리지는 사용 불가)
    if (!window.sentMessageIds) {
      window.sentMessageIds = new Set();
    }

    // 이미 전송한 메시지인지 확인
    if (window.sentMessageIds.has(messageId)) {
      console.log("이미 전송한 메시지입니다. 중복 전송 방지:", messageId);
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
    chrome.runtime.sendMessage({ action: "ping" }, function (response) {
      if (chrome.runtime.lastError) {
        console.log(
          "background에 연결할 수 없습니다. 데이터를 직접 storage에 저장합니다.",
        );

        // 추출된 데이터를 직접 storage에 저장
        if (messageWithId.action === "newTextExtracted") {
          saveExtractedItemToStorage(messageWithId.data);
        } else if (messageWithId.action === "bulkTextExtracted") {
          saveExtractedItemsToStorage(messageWithId.data);
        }

        return;
      }

      // background가 응답하면 메시지 전송
      chrome.runtime.sendMessage(messageWithId, function (response) {
        if (chrome.runtime.lastError) {
          console.log("메시지 전송 중 오류:", chrome.runtime.lastError.message);

          // 실패 시 직접 storage에 저장
          if (messageWithId.action === "newTextExtracted") {
            saveExtractedItemToStorage(messageWithId.data);
          } else if (messageWithId.action === "bulkTextExtracted") {
            saveExtractedItemsToStorage(messageWithId.data);
          }
        }
      });
    });
  } catch (error) {
    if (
      error.message &&
      error.message.includes("Extension context invalidated")
    ) {
      console.log(
        "확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.",
      );
      cleanupResources();
    } else {
      console.error("메시지 전송 중 오류:", error);

      // 예외 발생 시 직접 storage에 저장
      if (message.action === "newTextExtracted") {
        saveExtractedItemToStorage(message.data);
      } else if (message.action === "bulkTextExtracted") {
        saveExtractedItemsToStorage(message.data);
      }
    }
  }
}
// storage에 추출된 항목 저장
function saveExtractedItemToStorage(item) {
  try {
    chrome.storage.local.get(["extractedItems"], function (result) {
      if (chrome.runtime.lastError) {
        console.error("스토리지 접근 오류:", chrome.runtime.lastError.message);
        return;
      }

      let items = result.extractedItems || [];
      items.push(item);
      chrome.storage.local.set({ extractedItems: items });
    });
  } catch (error) {
    console.error("스토리지 저장 오류:", error);
  }
}

// storage에 여러 추출된 항목 저장
function saveExtractedItemsToStorage(newItems) {
  try {
    chrome.storage.local.get(["extractedItems"], function (result) {
      if (chrome.runtime.lastError) {
        console.error("스토리지 접근 오류:", chrome.runtime.lastError.message);
        return;
      }

      let items = result.extractedItems || [];
      items = [...items, ...newItems];
      chrome.storage.local.set({ extractedItems: items });
    });
  } catch (error) {
    console.error("스토리지 저장 오류:", error);
  }
}

// 리소스 정리 함수
function cleanupResources() {
  try {
    // 이벤트 리스너 제거
    document.removeEventListener("click", handleElementClick, true);
    document.removeEventListener("mousedown", handleSelectionStart, true);
    document.removeEventListener("mouseup", handleSelectionEnd, true);

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
    console.log("리소스 정리 중 오류:", e);
  }
}

// 컨텍스트 무효화 오류 처리를 위한 try-catch 래퍼
function tryCatchWrapper(fn) {
  return function (...args) {
    try {
      return fn.apply(this, args);
    } catch (error) {
      if (
        error.message &&
        error.message.includes("Extension context invalidated")
      ) {
        console.log(
          "확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.",
        );
        cleanupResources();
      } else {
        console.error("함수 실행 중 오류:", error);
      }
    }
  };
}

// 전역 오류 처리기
window.addEventListener("error", function (event) {
  if (
    event.error &&
    event.error.message &&
    event.error.message.includes("Extension context invalidated")
  ) {
    console.log(
      "확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.",
    );
    cleanupResources();
    event.preventDefault(); // 브라우저 콘솔에 오류 표시 방지
  }
});

// 메시지 리스너 설정
try {
  // 수정된 메시지 리스너 부분
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      console.log("Content script 메시지 수신:", request);

      try {
        if (request.action === "ping") {
          // 연결 확인용 핑
          sendResponse({ status: "pong" });
        } else if (request.action === "startExtract") {
          isAreaSelectionEnabled = request.enableAreaSelection || false;
          startExtraction();
          sendResponse({ status: "started" });
        } else if (request.action === "stopExtract") {
          stopExtraction();
          sendResponse({ status: "stopped" });
        } else if (request.action === "updateSettings") {
          isAreaSelectionEnabled = request.enableAreaSelection || false;
          sendResponse({ status: "updated" });
        } else if (request.action === "autoExtract") {
          // 새로운 옵션 객체 전달
          autoExtractText(
            request.tags,
            request.container,
            request.options || {},
          );
          sendResponse({ status: "extracting" });
        } else if (request.action === "captureSelection") {
          captureSelection();
          sendResponse({ status: "capturing" });
        } else if (request.action === "startElementSelection") {
          startElementSelection(request.selectionType);
          sendResponse({ status: "started" });
        }
      } catch (error) {
        if (
          error.message &&
          error.message.includes("Extension context invalidated")
        ) {
          console.log(
            "확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.",
          );
          cleanupResources();
        } else {
          console.error("메시지 처리 중 오류:", error);
          sendResponse({ status: "error", message: error.message });
        }
      }

      return true; // 비동기 응답을 위해 true 반환
    },
  );
} catch (error) {
  console.error("메시지 리스너 설정 중 오류:", error);
}

// 페이지 로드 시 확장 프로그램 상태 확인
try {
  chrome.storage.local.get(
    ["isExtracting", "enableAreaSelection"],
    function (result) {
      // runtime.lastError 체크
      if (chrome.runtime.lastError) {
        console.error("스토리지 접근 오류:", chrome.runtime.lastError.message);
        return;
      }

      if (result.isExtracting) {
        isAreaSelectionEnabled = result.enableAreaSelection || false;
        startExtraction();
      }
    },
  );
} catch (error) {
  console.error("스토리지 접근 중 오류:", error);
}

function startExtraction() {
  try {
    isExtracting = true;

    // 커서 스타일 저장 및 변경
    originalCursor = document.body.style.cursor;
    document.body.style.cursor = "crosshair";

    // 클릭 이벤트 리스너 추가
    document.addEventListener("click", handleElementClick, true);

    // 영역 선택 이벤트 리스너 추가 (활성화된 경우)
    if (isAreaSelectionEnabled) {
      document.addEventListener("mousedown", handleSelectionStart, true);
      document.addEventListener("mouseup", handleSelectionEnd, true);
    }

    // 말풍선 생성
    createTooltip();
  } catch (error) {
    if (
      error.message &&
      error.message.includes("Extension context invalidated")
    ) {
      console.log(
        "확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.",
      );
      cleanupResources();
    } else {
      console.error("startExtraction 중 오류:", error);
    }
  }
}

function stopExtraction() {
  try {
    isExtracting = false;

    // 커서 스타일 복원
    document.body.style.cursor = originalCursor;

    // 이벤트 리스너 제거
    document.removeEventListener("click", handleElementClick, true);
    document.removeEventListener("mousedown", handleSelectionStart, true);
    document.removeEventListener("mouseup", handleSelectionEnd, true);

    // 영역 선택 하이라이트 제거
    clearHighlights();

    // 말풍선 제거
    removeTooltip();
  } catch (error) {
    if (
      error.message &&
      error.message.includes("Extension context invalidated")
    ) {
      console.log(
        "확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.",
      );
    } else {
      console.error("stopExtraction 중 오류:", error);
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
      console.error("말풍선 표시 중 오류:", tooltipError);
      // 말풍선 오류가 발생해도 계속 진행
    }

    // 텍스트 추출 시도 (독립적으로 동작)
    try {
      extractElementText(clickedElement);
    } catch (extractError) {
      console.error("텍스트 추출 중 오류:", extractError);
    }
  } catch (error) {
    if (
      error.message &&
      error.message.includes("Extension context invalidated")
    ) {
      console.log(
        "확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.",
      );
      cleanupResources();
    } else {
      console.error("handleElementClick 중 오류:", error);
    }
  }
}

function extractElementText(element) {
  try {
    // 요소 정보 추출
    const elementId = element.id ? `#${element.id}` : "";
    const elementClasses =
      element.className && typeof element.className === "string"
        ? `.${element.className.split(" ").join(".")}`
        : "";
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
        action: "newTextExtracted",
        data: {
          elementInfo: elementInfo,
          text: extractedText,
          tagName: elementTag,
        },
      });

      // 사용자에게 피드백 제공
      showFeedback(element);
      return true;
    }

    return false;
  } catch (error) {
    if (
      error.message &&
      error.message.includes("Extension context invalidated")
    ) {
      console.log(
        "확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.",
      );
      cleanupResources();
    } else {
      console.error("extractElementText 중 오류:", error);
    }
    return false;
  }
}
function showFeedback(element) {
  try {
    // 요소 주변에 피드백 효과 표시
    const originalOutline = element.style.outline;
    const originalTransition = element.style.transition;

    element.style.transition = "outline 0.3s ease-in-out";
    element.style.outline = "2px solid #4285f4";

    setTimeout(() => {
      try {
        element.style.outline = originalOutline;
        element.style.transition = originalTransition;
      } catch (e) {
        console.log("피드백 복원 중 오류:", e);
      }
    }, 500);
  } catch (error) {
    console.error("showFeedback 중 오류:", error);
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
    if (
      error.message &&
      error.message.includes("Extension context invalidated")
    ) {
      console.log(
        "확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.",
      );
      cleanupResources();
    } else {
      console.error("handleSelectionStart 중 오류:", error);
    }
  }
}

function handleSelectionEnd(event) {
  try {
    if (
      !isExtracting ||
      !isAreaSelectionEnabled ||
      !event.shiftKey ||
      !selectionStartElement
    )
      return;

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
    if (
      error.message &&
      error.message.includes("Extension context invalidated")
    ) {
      console.log(
        "확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.",
      );
      cleanupResources();
    } else {
      console.error("handleSelectionEnd 중 오류:", error);
    }
  }
}

function findElementsBetween(startEl, endEl) {
  try {
    // 모든 텍스트를 포함하는 요소 찾기
    const textElements = Array.from(document.querySelectorAll("*")).filter(
      (el) => {
        const text = el.innerText.trim();
        return text.length > 0 && !el.contains(startEl) && !el.contains(endEl);
      },
    );

    // 시작 요소와 끝 요소의 위치 가져오기
    const startRect = startEl.getBoundingClientRect();
    const endRect = endEl.getBoundingClientRect();

    // 선택 영역의 범위 계산
    const selectionBox = {
      top: Math.min(startRect.top, endRect.top),
      right: Math.max(startRect.right, endRect.right),
      bottom: Math.max(startRect.bottom, endRect.bottom),
      left: Math.min(startRect.left, endRect.left),
    };

    // 선택 영역 내에 있는 요소들만 필터링
    return [
      startEl,
      ...textElements.filter((el) => {
        const rect = el.getBoundingClientRect();
        return (
          rect.top >= selectionBox.top &&
          rect.right <= selectionBox.right &&
          rect.bottom <= selectionBox.bottom &&
          rect.left >= selectionBox.left
        );
      }),
      endEl,
    ];
  } catch (error) {
    console.error("findElementsBetween 중 오류:", error);
    return [startEl, endEl];
  }
}

function extractElementsText(elements) {
  try {
    const extractedData = [];

    // 하이라이트 제거
    clearHighlights();

    // 각 요소 처리
    elements.forEach((element) => {
      try {
        // 요소 정보 추출
        const elementId = element.id ? `#${element.id}` : "";
        const elementClasses =
          element.className && typeof element.className === "string"
            ? `.${element.className.split(" ").join(".")}`
            : "";
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
            tagName: elementTag,
          });

          // 하이라이트 표시
          highlightElement(element);
        }
      } catch (elementError) {
        console.error("요소 처리 중 오류:", elementError);
      }
    });

    if (extractedData.length > 0) {
      // 확장 프로그램에 추출된 텍스트 전송
      safeSendMessage({
        action: "bulkTextExtracted",
        data: extractedData,
      });
    }
  } catch (error) {
    if (
      error.message &&
      error.message.includes("Extension context invalidated")
    ) {
      console.log(
        "확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.",
      );
      cleanupResources();
    } else {
      console.error("extractElementsText 중 오류:", error);
    }
  }
}

function highlightElement(element) {
  try {
    const originalOutline = element.style.outline;
    const originalZIndex = element.style.zIndex;
    const originalPosition = element.style.position;

    element.style.outline = "2px dashed #4285f4";
    element.style.zIndex = "9999";
    if (originalPosition === "static") {
      element.style.position = "relative";
    }

    currentHighlightedElements.push({
      element: element,
      originalOutline: originalOutline,
      originalZIndex: originalZIndex,
      originalPosition: originalPosition,
    });
  } catch (error) {
    console.error("highlightElement 중 오류:", error);
  }
}

function clearHighlights() {
  try {
    currentHighlightedElements.forEach((item) => {
      try {
        item.element.style.outline = item.originalOutline;
        item.element.style.zIndex = item.originalZIndex;
        item.element.style.position = item.originalPosition;
      } catch (elementError) {
        console.log("요소 하이라이트 제거 중 오류:", elementError);
      }
    });

    currentHighlightedElements = [];
  } catch (error) {
    console.error("clearHighlights 중 오류:", error);
  }
}

// 현재 선택된 텍스트 추출
function captureSelection() {
  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      safeSendMessage({
        action: "extractionError",
        data: {
          message:
            "선택된 텍스트가 없습니다. 텍스트를 드래그하여 선택해주세요.",
        },
      });
      return;
    }

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === 3 ? container.parentNode : container;

    // 요소 정보 추출
    const elementId = element.id ? `#${element.id}` : "";
    const elementClasses =
      element.className && typeof element.className === "string"
        ? `.${element.className.split(" ").join(".")}`
        : "";
    const elementTag = element.tagName.toLowerCase();

    // 요소 정보 문자열 생성
    let elementInfo = elementTag;
    if (elementId) elementInfo += elementId;
    if (elementClasses) elementInfo += elementClasses;

    // 텍스트 추출
    const extractedText = selection.toString().trim();

    if (extractedText) {
      safeSendMessage({
        action: "newTextExtracted",
        data: {
          elementInfo: elementInfo + " (선택 영역)",
          text: extractedText,
          tagName: elementTag,
        },
      });

      showFeedback(element);
    }
  } catch (error) {
    if (
      error.message &&
      error.message.includes("Extension context invalidated")
    ) {
      console.log(
        "확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.",
      );
      cleanupResources();
    } else {
      console.error("captureSelection 중 오류:", error);
    }
  }
}

// 자동 추출 기능
function autoExtractText(tagsString, containerString) {
  // 이미 추출 중이면 중복 실행 방지
  if (isAutoExtracting) {
    console.log("자동 추출이 이미 진행 중입니다.");
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

        containers.forEach((container) => {
          // 컨테이너 내의 텍스트를 포함하는 모든 요소
          const textElements = Array.from(
            container.querySelectorAll("*"),
          ).filter((el) => {
            const text = el.innerText.trim();
            return (
              text.length > 0 &&
              !Array.from(el.children).some(
                (child) => child.innerText.trim().length > 0,
              )
            );
          });

          textElements.forEach((element) => {
            if (!extractedElements.includes(element)) {
              extractedElements.push(element);
            }
          });
        });
      }

      if (tagsString) {
        // 특정 태그/클래스/ID 선택자에 해당하는 요소 추출
        const selectors = tagsString
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        selectors.forEach((selector) => {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach((element) => {
              if (!extractedElements.includes(element)) {
                extractedElements.push(element);
              }
            });
          } catch (selectorError) {
            console.error("선택자 오류:", selector, selectorError);
          }
        });
      }

      // 중복 제거
      const uniqueElements = Array.from(new Set(extractedElements));

      // 텍스트 추출 및 전송
      const extractedData = [];

      uniqueElements.forEach((element) => {
        try {
          // 요소 정보 추출
          const elementId = element.id ? `#${element.id}` : "";
          const elementClasses =
            element.className && typeof element.className === "string"
              ? `.${element.className.split(" ").join(".")}`
              : "";
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
              tagName: elementTag,
            });

            // 피드백 표시
            showFeedback(element);
          }
        } catch (elementError) {
          console.error("요소 처리 중 오류:", elementError);
        }
      });

      if (extractedData.length > 0) {
        // 로그 추가
        console.log(
          `${extractedData.length}개 항목 추출 완료, 메시지 전송 중...`,
        );

        // 확장 프로그램에 추출된 텍스트 전송 (한 번만)
        safeSendMessage({
          action: "bulkTextExtracted",
          data: extractedData,
        });
      } else {
        safeSendMessage({
          action: "extractionError",
          data: {
            message:
              "지정한 선택자에 해당하는 요소를 찾을 수 없거나 텍스트가 없습니다.",
          },
        });
      }
    } catch (innerError) {
      console.error("자동 추출 내부 오류:", innerError);

      // 오류 알림
      safeSendMessage({
        action: "extractionError",
        data: {
          message: "자동 추출 중 오류가 발생했습니다: " + innerError.message,
        },
      });
    } finally {
      // 작업 완료 후 상태 초기화
      setTimeout(() => {
        isAutoExtracting = false;
        console.log("자동 추출 상태 초기화 완료");
      }, 1000); // 재실행 방지를 위해 약간의 지연 추가
    }
  } catch (error) {
    if (
      error.message &&
      error.message.includes("Extension context invalidated")
    ) {
      console.log(
        "확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.",
      );
      cleanupResources();
    } else {
      console.error("autoExtractText 중 오류:", error);

      // 오류 알림
      try {
        safeSendMessage({
          action: "extractionError",
          data: {
            message: "자동 추출 중 오류가 발생했습니다: " + error.message,
          },
        });
      } catch (sendError) {
        console.error("오류 메시지 전송 실패:", sendError);
      }
    }

    // 오류 발생 시에도 상태 초기화
    isAutoExtracting = false;
  }
}

// 요소 선택 모드 시작 함수 - 더보기 버튼 선택 지원 추가됨
function startElementSelection(type) {
  try {
    isElementSelectionMode = true;
    elementSelectionType = type;

    // 원래 커서 저장 및 변경
    originalCursor = document.body.style.cursor;
    document.body.style.cursor = "crosshair";

    // 한 번만 클릭 이벤트를 처리하는 함수 추가
    document.addEventListener("click", handleSelectorElementClick, true);

    // 작업을 중단할 수 있도록 ESC 키 이벤트 추가
    document.addEventListener("keydown", handleSelectionKeydown, true);
  } catch (error) {
    console.error("startElementSelection 중 오류:", error);
    cleanupElementSelection();
  }
}

// 선택 모드에서의 키 이벤트 처리
function handleSelectionKeydown(event) {
  // ESC 키를 누르면 선택 모드 종료
  if (event.key === "Escape" && isElementSelectionMode) {
    event.preventDefault();
    event.stopPropagation();
    cleanupElementSelection();
  }
}

// 수정된 선택자 요소 클릭 처리 함수 - 버튼 선택 유형 추가됨
function handleSelectorElementClick(event) {
  try {
    if (!isElementSelectionMode) return;

    // 이벤트 기본 동작 방지
    event.preventDefault();
    event.stopPropagation();

    // 클릭된 요소
    const clickedElement = event.target;

    // 선택된 요소에서 최적의 선택자 생성
    const selector = generateOptimalSelector(
      clickedElement,
      elementSelectionType,
    );
    console.log("생성된 선택자:", selector, "유형:", elementSelectionType);

    // 요소 정보 팝업 표시
    try {
      showTooltip(clickedElement, event);

      // 3초 후 말풍선 숨기기
      setTimeout(hideTooltip, 3000);
    } catch (tooltipError) {
      console.error("말풍선 표시 중 오류:", tooltipError);
    }

    // 선택자를 background로 전송 (팝업이 닫혀있을 수 있으므로)
    chrome.runtime.sendMessage(
      {
        action: "elementSelectorGenerated",
        selectionType: elementSelectionType,
        selector: selector,
      },
      function (response) {
        if (chrome.runtime.lastError) {
          console.log("메시지 전송 중 오류:", chrome.runtime.lastError.message);
        } else {
          console.log("선택자가 백그라운드로 전송됨", response);
        }
      },
    );

    // 피드백 제공
    showFeedback(clickedElement);

    // 선택 유형에 따른 알림 메시지 설정
    let message;
    if (elementSelectionType === "tag") {
      message = "태그 선택자로 추가되었습니다. 팝업 창을 다시 열어주세요.";
    } else if (elementSelectionType === "container") {
      message = "컨테이너 선택자로 추가되었습니다. 팝업 창을 다시 열어주세요.";
    } else if (elementSelectionType === "button") {
      message = "버튼 선택자로 추가되었습니다. 팝업 창을 다시 열어주세요.";
    }

    // 화면 상단에 간단한 알림 표시
    showNotification(message);

    // 선택 모드 종료
    cleanupElementSelection();
  } catch (error) {
    console.error("handleSelectorElementClick 중 오류:", error);
    cleanupElementSelection();
  }
}

// 화면에 알림 표시 함수
function showNotification(message) {
  try {
    // 이미 존재하는 알림 제거
    const existingNotification = document.getElementById(
      "hani-extractor-notification",
    );
    if (existingNotification) {
      existingNotification.remove();
    }

    // 새 알림 생성
    const notification = document.createElement("div");
    notification.id = "hani-extractor-notification";
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
    console.error("알림 표시 중 오류:", error);
  }
}

// 선택 모드 정리 함수
function cleanupElementSelection() {
  try {
    // 이벤트 리스너 제거
    document.removeEventListener("click", handleSelectorElementClick, true);
    document.removeEventListener("keydown", handleSelectionKeydown, true);

    // 커서 복원
    document.body.style.cursor = originalCursor;

    // 상태 변수 초기화
    isElementSelectionMode = false;
    elementSelectionType = null;
  } catch (error) {
    console.error("cleanupElementSelection 중 오류:", error);
  }
}

// 최적의 CSS 선택자 생성 함수
function generateOptimalSelector(element, type) {
  try {
    // 요소의 기본 정보 추출
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : "";
    const classes =
      element.className && typeof element.className === "string"
        ? Array.from(element.classList)
            .filter((c) => c)
            .map((c) => `.${c}`)
            .join("")
        : "";

    // 기본 선택자 구성
    let selector = tagName;

    // ID가 있으면 ID 기반 선택자 생성 (가장 구체적이고 선호됨)
    if (id) {
      selector = type === "tag" ? `${tagName}${id}` : id;
      return selector;
    }

    // 클래스가 있으면 클래스 기반 선택자 생성
    if (classes) {
      if (type === "tag") {
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
        const parentId = parent.id ? `#${parent.id}` : "";
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
    console.error("generateOptimalSelector 중 오류:", error);
    // 오류 발생 시 기본 선택자 반환
    return element.tagName.toLowerCase();
  }
}

// 페이지 자동 스크롤 함수 - 새로 추가됨
async function autoScrollPage() {
  return new Promise((resolve) => {
    const scrollHeight = () => document.documentElement.scrollHeight;
    let lastScrollHeight = scrollHeight();
    let scrollAttempts = 0;
    const maxScrollAttempts = 50; // 무한 루프 방지를 위한 안전 제한

    // 스크롤 진행 상태 표시기 생성
    const indicator = document.createElement("div");
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 8px 12px;
      background: rgba(66, 133, 244, 0.9);
      color: white;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    `;
    indicator.textContent = "자동 스크롤 중...";
    document.body.appendChild(indicator);

    // 스크롤 인터벌 함수
    const scrollInterval = setInterval(() => {
      // 한 화면 높이만큼 아래로 스크롤
      window.scrollBy(0, window.innerHeight);

      // 진행 상태 업데이트
      scrollAttempts++;
      indicator.textContent = `자동 스크롤 중... (${scrollAttempts})`;

      // 콘텐츠가 로드될 시간을 주기 위해 1.5초 대기
      setTimeout(() => {
        // 페이지 끝에 도달했는지 또는 새 콘텐츠가 로드되지 않는지 확인
        const newScrollHeight = scrollHeight();

        // 페이지 끝에 도달했거나 새 콘텐츠가 로드되지 않음
        if (
          window.innerHeight + window.scrollY >= newScrollHeight - 100 ||
          (newScrollHeight === lastScrollHeight && scrollAttempts > 2) ||
          scrollAttempts >= maxScrollAttempts
        ) {
          clearInterval(scrollInterval);
          indicator.textContent = "스크롤 완료";

          // 표시기 제거 및 페이지 상단으로 스크롤
          setTimeout(() => {
            if (indicator.parentNode) {
              indicator.parentNode.removeChild(indicator);
            }
            window.scrollTo(0, 0);
            resolve(true);
          }, 1000);
        }

        lastScrollHeight = newScrollHeight;
      }, 1500);
    }, 2000); // 2초마다 스크롤
  });
}

// 더보기 버튼 자동 클릭 함수 - 정밀 선택 로직 개선 버전
async function clickLoadMoreButtons(selectors) {
  return new Promise((resolve) => {
    // 일반적인 "더보기" 버튼 선택자 기본값 - 우선순위가 낮음
    const defaultSelectors = [
      ".more",
      ".load-more",
      ".btn-more",
      ".more-btn",
      '[id*="more"]',
      '[class*="more"]',
      '[id*="load"]',
      '[class*="load"]',
      'button:contains("더보기")',
      'a:contains("더보기")',
      'button:contains("더 보기")',
      'a:contains("더 보기")',
      'button:contains("load more")',
      'a:contains("load more")',
      'button:contains("Show more")',
      'a:contains("Show more")',
    ];

    // 사용자 정의 선택자 처리 - 우선순위가 높음
    let userSelectors = [];
    if (selectors && selectors.trim()) {
      userSelectors = selectors
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    // 버튼 클릭 진행 상태 표시기 생성
    const indicator = document.createElement("div");
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 8px 12px;
      background: rgba(52, 168, 83, 0.9);
      color: white;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    `;
    indicator.textContent = "버튼 검색 중...";
    document.body.appendChild(indicator);

    let clickCount = 0;
    let noButtonsCount = 0;
    let scrollCount = 0;
    const maxClicks = 100; // 안전 제한
    const maxScrolls = 50; // 최대 스크롤 시도 횟수

    // 버튼에 표시할 디버그 하이라이트
    const highlightButton = (button, color = "rgba(52, 168, 83, 0.3)") => {
      if (!button) return;

      try {
        // 원래 스타일 저장
        const originalOutline = button.style.outline;
        const originalBoxShadow = button.style.boxShadow;

        // 하이라이트 적용
        button.style.outline = `2px solid ${color}`;
        button.style.boxShadow = `0 0 5px ${color}`;

        // 원래 스타일로 복원
        setTimeout(() => {
          button.style.outline = originalOutline;
          button.style.boxShadow = originalBoxShadow;
        }, 1000);
      } catch (e) {
        console.log("버튼 하이라이트 실패:", e);
      }
    };

    // 선택자 기반으로 버튼 찾기 - 우선순위 적용
    const findButtonsBySelector = (selectorsList) => {
      const result = [];

      for (const selector of selectorsList) {
        try {
          // 선택자에 경로 구분자('>')가 있거나 복잡한 경우 특수 처리
          const isComplexSelector =
            selector.includes(">") ||
            selector.includes(" ") ||
            selector.match(/\.[a-zA-Z0-9_-]+/g)?.length > 1;

          console.log(
            `선택자 시도: "${selector}", 복잡한 선택자: ${isComplexSelector}`,
          );

          let buttons = [];

          if (isComplexSelector) {
            // 복잡한 선택자는 특수 처리
            buttons = findButtonsWithComplexSelector(selector);
          } else {
            // 일반 선택자는 기존 방식으로 처리
            buttons = document.querySelectorAll(selector);
          }

          console.log(`찾은 버튼 수: ${buttons.length}`);

          // 유효한 버튼 필터링
          const validButtons = Array.from(buttons).filter((btn) => {
            return isClickable(btn);
          });

          // 필터링된 유효 버튼 정보 로깅
          console.log(
            `유효한 버튼 ${validButtons.length}개 찾음 (선택자: ${selector})`,
          );

          if (validButtons.length > 0) {
            result.push(
              ...validButtons.map((btn) => ({
                button: btn,
                isPrecise: isComplexSelector,
                selector: selector,
              })),
            );
          }
        } catch (error) {
          console.error(`선택자 '${selector}' 처리 중 오류:`, error);
        }
      }

      // 우선순위 정렬 (복잡한 선택자 우선)
      result.sort((a, b) => {
        if (a.isPrecise && !b.isPrecise) return -1;
        if (!a.isPrecise && b.isPrecise) return 1;
        return 0;
      });

      return result;
    };

    // 버튼 클릭 시도 - 여러 방법 시도
    const triggerButtonClick = (button) => {
      if (!button) return false;

      try {
        // 하이라이트 표시
        highlightButton(button);

        // 클릭 전에 버튼을 화면 중앙에 배치
        button.scrollIntoView({ behavior: "smooth", block: "center" });

        // 약간 대기 후 클릭
        setTimeout(() => {
          try {
            // 1. 기본 클릭 방법
            button.click();
          } catch (err1) {
            console.log("기본 클릭 실패, 대체 방법 시도:", err1);

            try {
              // 2. 클릭 이벤트 발생
              const clickEvent = new MouseEvent("click", {
                view: window,
                bubbles: true,
                cancelable: true,
              });
              button.dispatchEvent(clickEvent);
            } catch (err2) {
              console.log("이벤트 발생 실패:", err2);

              // 3. a 태그 처리
              if (button.tagName.toLowerCase() === "a" && button.href) {
                try {
                  window.location.href = button.href;
                } catch (err3) {
                  console.log("a 태그 처리 실패:", err3);
                }
              }
            }
          }
        }, 500);

        return true;
      } catch (error) {
        console.error("버튼 클릭 처리 실패:", error);
        return false;
      }
    };

    // 버튼 찾고 클릭하는 메인 함수
    const findAndClickButton = () => {
      // 버튼 찾기
      const buttons = findButtonsBySelector();

      // 1. 화면에 보이는 사용자 정의 버튼 (최우선)
      if (buttons.visibleUserButtons.length > 0) {
        clickCount++;
        indicator.textContent = `사용자 정의 버튼 클릭 중... (${clickCount})`;
        console.log(
          "클릭: 화면에 보이는 사용자 정의 버튼",
          buttons.visibleUserButtons[0],
        );

        // 사용자가 지정한 버튼 중 첫 번째 보이는 것을 클릭
        triggerButtonClick(buttons.visibleUserButtons[0]);
        setTimeout(processNext, 2000);
        return true;
      }

      // 2. 화면에 보이지 않는 사용자 정의 버튼 (스크롤 필요)
      if (buttons.userButtons.length > 0) {
        scrollCount++;
        indicator.textContent = `사용자 정의 버튼으로 스크롤 중... (${scrollCount})`;
        console.log("스크롤: 사용자 정의 버튼으로", buttons.userButtons[0]);

        // 사용자가 지정한 버튼으로 스크롤
        buttons.userButtons[0].scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        setTimeout(processNext, 1500);
        return true;
      }

      // 3. 화면에 보이는 기본 버튼 (사용자 정의 버튼이 없을 때만)
      if (buttons.visibleDefaultButtons.length > 0) {
        clickCount++;
        indicator.textContent = `기본 버튼 클릭 중... (${clickCount})`;
        console.log(
          "클릭: 화면에 보이는 기본 버튼",
          buttons.visibleDefaultButtons[0],
        );

        // 기본 버튼 중 첫 번째 보이는 것을 클릭
        triggerButtonClick(buttons.visibleDefaultButtons[0]);
        setTimeout(processNext, 2000);
        return true;
      }

      // 4. 화면에 보이지 않는 기본 버튼 (스크롤 필요)
      if (buttons.defaultButtons.length > 0) {
        scrollCount++;
        indicator.textContent = `기본 버튼으로 스크롤 중... (${scrollCount})`;
        console.log("스크롤: 기본 버튼으로", buttons.defaultButtons[0]);

        // 기본 버튼으로 스크롤
        buttons.defaultButtons[0].scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        setTimeout(processNext, 1500);
        return true;
      }

      // 버튼을 찾지 못함
      return false;
    };

    // 일반 페이지 스크롤
    const scrollPageDown = () => {
      scrollCount++;
      indicator.textContent = `페이지 스크롤 중... (${scrollCount})`;

      // 이전 스크롤 위치 저장
      const beforeScroll = window.scrollY;

      // 페이지 아래로 스크롤
      window.scrollBy({
        top: window.innerHeight * 0.7,
        behavior: "smooth",
      });

      // 약간 대기 후 스크롤이 실제로 이동했는지 확인
      setTimeout(() => {
        const afterScroll = window.scrollY;

        // 스크롤이 더 이상 움직이지 않으면 페이지 끝에 도달한 것
        if (Math.abs(afterScroll - beforeScroll) < 10 && scrollCount > 3) {
          noButtonsCount = 3; // 더 이상 진행하지 않도록 설정
        }

        processNext();
      }, 1200);

      return true;
    };

    // 다음 단계 처리
    const processNext = () => {
      // 최대 클릭 횟수 도달 체크
      if (clickCount >= maxClicks || scrollCount >= maxScrolls) {
        indicator.textContent = "최대 시도 횟수 도달, 완료";
        finishProcess();
        return;
      }

      // 버튼 찾기 및 클릭 시도
      const buttonFound = findAndClickButton();

      if (!buttonFound) {
        // 버튼을 찾지 못했을 때
        noButtonsCount++;

        if (noButtonsCount < 3) {
          // 버튼을 찾을 때까지 페이지 스크롤 시도
          scrollPageDown();
        } else {
          // 여러 번 시도 후에도 버튼을 찾지 못하면 완료
          indicator.textContent = "더 이상 버튼을 찾을 수 없음, 완료";
          finishProcess();
        }
      }
    };

    // 작업 완료 및 정리
    const finishProcess = () => {
      setTimeout(() => {
        // 표시기 제거
        if (indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }

        // 페이지 상단으로 스크롤
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
          setTimeout(() => {
            resolve(clickCount);
          }, 500);
        }, 500);
      }, 1000);
    };

    // 처리 시작
    setTimeout(processNext, 800);
  });
}

// 동적 콘텐츠 지원이 개선된 자동 추출 함수
async function autoExtractText(tagsString, containerString, options = {}) {
  // 이미 추출 중이면 중복 실행 방지
  if (isAutoExtracting) {
    console.log("자동 추출이 이미 진행 중입니다.");
    return;
  }

  try {
    if (!tagsString && !containerString) return;

    // 추출 상태 설정
    isAutoExtracting = true;

    // 옵션이 활성화된 경우 먼저 동적 콘텐츠 처리
    if (options.enableAutoScroll) {
      await autoScrollPage();
    }

    if (options.enableLoadMoreButtons) {
      await clickLoadMoreButtons(options.loadMoreButtonSelectors);
    }

    const extractedElements = [];
    const processedTexts = new Set(); // 중복 텍스트 방지를 위한 Set

    try {
      if (containerString) {
        // 컨테이너 내 모든 텍스트 요소 추출
        const containers = document.querySelectorAll(containerString);

        containers.forEach((container) => {
          // 컨테이너 내의 텍스트를 포함하는 모든 요소
          const textElements = Array.from(
            container.querySelectorAll("*"),
          ).filter((el) => {
            const text = el.innerText.trim();
            return (
              text.length > 0 &&
              !Array.from(el.children).some(
                (child) => child.innerText.trim().length > 0,
              )
            );
          });

          textElements.forEach((element) => {
            if (!extractedElements.includes(element)) {
              extractedElements.push(element);
            }
          });
        });
      }

      if (tagsString) {
        // 특정 태그/클래스/ID 선택자에 해당하는 요소 추출
        const selectors = tagsString
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        selectors.forEach((selector) => {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach((element) => {
              if (!extractedElements.includes(element)) {
                extractedElements.push(element);
              }
            });
          } catch (selectorError) {
            console.error("선택자 오류:", selector, selectorError);
          }
        });
      }

      // 중복 제거
      const uniqueElements = Array.from(new Set(extractedElements));

      // 텍스트 추출 및 전송
      const extractedData = [];

      uniqueElements.forEach((element) => {
        try {
          // 요소 정보 추출
          const elementId = element.id ? `#${element.id}` : "";
          const elementClasses =
            element.className && typeof element.className === "string"
              ? `.${element.className.split(" ").join(".")}`
              : "";
          const elementTag = element.tagName.toLowerCase();

          // 요소 정보 문자열 생성
          let elementInfo = elementTag;
          if (elementId) elementInfo += elementId;
          if (elementClasses) elementInfo += elementClasses;

          // 텍스트 추출
          const extractedText = element.innerText.trim();

          // 중복 체크
          if (extractedText && !processedTexts.has(extractedText)) {
            // 중복 방지를 위해 Set에 추가
            processedTexts.add(extractedText);

            extractedData.push({
              elementInfo: elementInfo,
              text: extractedText,
              tagName: elementTag,
            });

            // 피드백 표시
            showFeedback(element);
          }
        } catch (elementError) {
          console.error("요소 처리 중 오류:", elementError);
        }
      });

      if (extractedData.length > 0) {
        // 로그 추가
        console.log(
          `${extractedData.length}개 항목 추출 완료, 메시지 전송 중...`,
        );

        // 확장 프로그램에 추출된 텍스트 전송 (한 번만)
        safeSendMessage({
          action: "bulkTextExtracted",
          data: extractedData,
        });
      } else {
        safeSendMessage({
          action: "extractionError",
          data: {
            message:
              "지정한 선택자에 해당하는 요소를 찾을 수 없거나 텍스트가 없습니다.",
          },
        });
      }
    } catch (innerError) {
      console.error("자동 추출 내부 오류:", innerError);

      // 오류 알림
      safeSendMessage({
        action: "extractionError",
        data: {
          message: "자동 추출 중 오류가 발생했습니다: " + innerError.message,
        },
      });
    } finally {
      // 작업 완료 후 상태 초기화
      setTimeout(() => {
        isAutoExtracting = false;
        console.log("자동 추출 상태 초기화 완료");
      }, 1000); // 재실행 방지를 위해 약간의 지연 추가
    }
  } catch (error) {
    if (
      error.message &&
      error.message.includes("Extension context invalidated")
    ) {
      console.log(
        "확장 프로그램 컨텍스트가 무효화되었습니다. 페이지를 새로고침하세요.",
      );
      cleanupResources();
    } else {
      console.error("autoExtractText 중 오류:", error);

      // 오류 알림
      try {
        safeSendMessage({
          action: "extractionError",
          data: {
            message: "자동 추출 중 오류가 발생했습니다: " + error.message,
          },
        });
      } catch (sendError) {
        console.error("오류 메시지 전송 실패:", sendError);
      }
    }

    // 오류 발생 시에도 상태 초기화
    isAutoExtracting = false;
  }
}

// content.js에 추가: 상위 요소를 고려한 더 정밀한 선택자 생성 함수
function generatePreciseSelector(element, type) {
  try {
    // 기본 요소 정보 추출
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : "";
    const classes =
      element.className && typeof element.className === "string"
        ? element.className
            .split(" ")
            .filter((c) => c)
            .map((c) => `.${c}`)
        : [];

    // ID가 있는 경우 ID 선택자 반환 (가장 정밀함)
    if (id) {
      return type === "tag" ? `${tagName}${id}` : id;
    }

    // 클래스가 있는 경우 요소명 + 클래스 조합
    let selector = tagName;
    if (classes.length > 0) {
      selector += classes.join("");
    }

    // 상위 요소 경로 추가 (최대 3단계까지)
    let currentElement = element;
    let parentSelectors = [];
    let depth = 0;

    while (currentElement.parentElement && depth < 3) {
      const parent = currentElement.parentElement;
      const parentTag = parent.tagName.toLowerCase();

      // 상위 요소 선택자 생성
      let parentSelector = parentTag;

      // ID가 있으면 추가 (가장 구체적)
      if (parent.id) {
        parentSelector += `#${parent.id}`;
        parentSelectors.unshift(parentSelector);
        break; // ID가 있으면 더 올라갈 필요 없음
      }

      // 클래스가 있으면 추가
      if (parent.className && typeof parent.className === "string") {
        const parentClasses = parent.className
          .split(" ")
          .filter((c) => c)
          .map((c) => `.${c}`)
          .join("");

        if (parentClasses) {
          parentSelector += parentClasses;
        }
      }

      parentSelectors.unshift(parentSelector);
      currentElement = parent;
      depth++;

      // body나 html에 도달하면 중단
      if (parentTag === "body" || parentTag === "html") {
        break;
      }
    }

    // 최종 선택자 생성
    let finalSelector;

    if (type === "button") {
      // 버튼 선택의 경우, 상위 요소 포함하여 정밀한 선택자 생성
      if (parentSelectors.length > 0) {
        finalSelector = parentSelectors.join(" > ") + " > " + selector;
      } else {
        finalSelector = selector;
      }
    } else if (type === "tag" || type === "container") {
      // 태그나 컨테이너의 경우 원래 선택자 그대로 반환
      finalSelector = selector;
    }

    return finalSelector;
  } catch (error) {
    console.error("정밀 선택자 생성 중 오류:", error);
    return element.tagName.toLowerCase(); // 오류 시 기본 태그명만 반환
  }
}

// clickLoadMoreButtons 함수 수정 - 정밀 선택자 처리 로직 추가
async function clickLoadMoreButtons(selectors) {
  return new Promise((resolve) => {
    // 일반적인 "더보기" 버튼 선택자 기본값
    const defaultSelectors = [
      ".more",
      ".load-more",
      ".btn-more",
      ".more-btn",
      '[id*="more"]',
      '[class*="more"]',
      '[id*="load"]',
      '[class*="load"]',
      'button:contains("더보기")',
      'a:contains("더보기")',
      'button:contains("더 보기")',
      'a:contains("더 보기")',
      'button:contains("load more")',
      'a:contains("load more")',
      'button:contains("Show more")',
      'a:contains("Show more")',
    ];

    // 사용자 정의 선택자 처리 - 정확한 선택자 우선
    let userSelectors = [];
    if (selectors && selectors.trim()) {
      userSelectors = selectors
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // 사용자 선택자에 '>'가 포함되어 있으면 정밀 선택자로 간주
      const hasPreciseSelectors = userSelectors.some((selector) =>
        selector.includes(">"),
      );
      console.log("정밀 선택자 포함 여부:", hasPreciseSelectors);
    }

    // 버튼 클릭 진행 상태 표시기 생성
    const indicator = document.createElement("div");
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 8px 12px;
      background: rgba(52, 168, 83, 0.9);
      color: white;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    `;
    indicator.textContent = "버튼 검색 중...";
    document.body.appendChild(indicator);

    let clickCount = 0;
    let noButtonsCount = 0;
    let scrollCount = 0;
    const maxClicks = 100;
    const maxScrolls = 50;

    // 버튼에 표시할 디버그 하이라이트
    const highlightButton = (button, color = "rgba(52, 168, 83, 0.3)") => {
      if (!button) return;

      try {
        // 원래 스타일 저장
        const originalOutline = button.style.outline;
        const originalBoxShadow = button.style.boxShadow;

        // 하이라이트 적용
        button.style.outline = `2px solid ${color}`;
        button.style.boxShadow = `0 0 5px ${color}`;

        // 스타일 값 콘솔에 표시
        console.log("버튼 스타일 적용됨:", color);
        console.log("버튼 텍스트:", button.innerText || button.textContent);

        // 원래 스타일로 복원
        setTimeout(() => {
          button.style.outline = originalOutline;
          button.style.boxShadow = originalBoxShadow;
        }, 1000);
      } catch (e) {
        console.log("버튼 하이라이트 실패:", e);
      }
    };

    // 선택자로 정확한 버튼 찾기
    const findPreciseButtons = (selectorsList) => {
      const result = [];

      for (const selector of selectorsList) {
        try {
          // 선택자에 경로 구분자('>')가 있는지 확인
          const isPreciseSelector = selector.includes(">");

          // 디버그 로그
          console.log(
            `선택자 시도: "${selector}", 정밀 선택자: ${isPreciseSelector}`,
          );

          const buttons = document.querySelectorAll(selector);
          console.log(`찾은 버튼 수: ${buttons.length}`);

          // 유효한 버튼 필터링
          const validButtons = Array.from(buttons).filter((btn) => {
            try {
              // 기본적인 유효성 검사
              const styles = window.getComputedStyle(btn);
              const rect = btn.getBoundingClientRect();

              const isValid =
                rect.width > 0 &&
                rect.height > 0 &&
                styles.display !== "none" &&
                styles.visibility !== "hidden" &&
                styles.opacity !== "0" &&
                !btn.disabled &&
                // 텍스트 내용이 있는지 추가 검사 (더보기 버튼은 보통 텍스트가 있음)
                (btn.innerText.trim() ||
                  btn.textContent.trim() ||
                  btn.value ||
                  btn.getAttribute("aria-label") ||
                  btn.title);

              if (isValid) {
                console.log("유효한 버튼 찾음:", btn.outerHTML.slice(0, 100));

                // 정밀 선택자가 아닌 경우 텍스트 내용 추가 검사
                if (!isPreciseSelector) {
                  const text = (
                    btn.innerText ||
                    btn.textContent ||
                    ""
                  ).toLowerCase();
                  const hasMoreText =
                    text.includes("더보기") ||
                    text.includes("더 보기") ||
                    text.includes("more") ||
                    text.includes("load");
                  return hasMoreText;
                }

                return true;
              }

              return false;
            } catch (e) {
              console.log("버튼 검증 오류:", e);
              return false;
            }
          });

          // 필터링된 유효 버튼 정보 로깅
          console.log(
            `유효한 버튼 ${validButtons.length}개 찾음 (선택자: ${selector})`,
          );

          // 정밀 선택자(경로가 포함된)가 있는 경우 먼저 처리
          if (isPreciseSelector && validButtons.length > 0) {
            console.log("정밀 선택자로 버튼 찾음, 최우선 처리");
            result.push(
              ...validButtons.map((btn) => ({
                button: btn,
                isPrecise: true,
                selector: selector,
              })),
            );
          } else if (validButtons.length > 0) {
            // 일반 선택자
            result.push(
              ...validButtons.map((btn) => ({
                button: btn,
                isPrecise: false,
                selector: selector,
              })),
            );
          }
        } catch (error) {
          console.error(`선택자 '${selector}' 처리 중 오류:`, error);
        }
      }

      // 정밀 선택자 우선, 그 다음 일반 선택자
      result.sort((a, b) => {
        if (a.isPrecise && !b.isPrecise) return -1;
        if (!a.isPrecise && b.isPrecise) return 1;
        return 0;
      });

      return result;
    };

    // 버튼 클릭 시도 - 여러 방법 시도
    const triggerButtonClick = (buttonInfo) => {
      if (!buttonInfo || !buttonInfo.button) return false;

      const button = buttonInfo.button;

      try {
        // 하이라이트 표시
        highlightButton(
          button,
          buttonInfo.isPrecise
            ? "rgba(66, 133, 244, 0.5)"
            : "rgba(52, 168, 83, 0.3)",
        );

        // 디버그 정보 출력
        console.log("버튼 클릭 시도:", buttonInfo.selector);
        console.log("버튼 HTML:", button.outerHTML.slice(0, 200));

        // 클릭 전에 버튼을 화면 중앙에 배치
        button.scrollIntoView({ behavior: "smooth", block: "center" });

        // 약간 대기 후 클릭
        setTimeout(() => {
          try {
            // 1. 기본 클릭 방법
            button.click();
            console.log("기본 클릭 성공");
          } catch (err1) {
            console.log("기본 클릭 실패, 대체 방법 시도:", err1);

            try {
              // 2. 클릭 이벤트 발생
              const clickEvent = new MouseEvent("click", {
                view: window,
                bubbles: true,
                cancelable: true,
              });
              button.dispatchEvent(clickEvent);
              console.log("이벤트 발생 성공");
            } catch (err2) {
              console.log("이벤트 발생 실패:", err2);

              // 3. a 태그 처리
              if (button.tagName.toLowerCase() === "a" && button.href) {
                try {
                  window.location.href = button.href;
                  console.log("a 태그 href 처리 성공");
                } catch (err3) {
                  console.log("a 태그 처리 실패:", err3);
                }
              }
            }
          }
        }, 500);

        return true;
      } catch (error) {
        console.error("버튼 클릭 처리 실패:", error);
        return false;
      }
    };

    // 메인 처리 로직
    const processButtons = () => {
      // 1. 먼저 사용자 정의 선택자로 검색
      let buttons = [];
      if (userSelectors.length > 0) {
        buttons = findPreciseButtons(userSelectors);
        console.log(`사용자 정의 선택자로 ${buttons.length}개 버튼 찾음`);
      }

      // 2. 사용자 정의 선택자로 버튼을 찾지 못했을 때만 기본 선택자 사용
      if (buttons.length === 0) {
        buttons = findPreciseButtons(defaultSelectors);
        console.log(`기본 선택자로 ${buttons.length}개 버튼 찾음`);
      }

      // 버튼 없음
      if (buttons.length === 0) {
        return false;
      }

      // 화면에 보이는 버튼 필터링
      const visibleButtons = buttons.filter((info) => {
        try {
          const rect = info.button.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= window.innerHeight;
        } catch (e) {
          return false;
        }
      });

      // 화면에 보이는 버튼이 있으면 클릭
      if (visibleButtons.length > 0) {
        clickCount++;

        // 먼저 정밀 선택자로 찾은 버튼 클릭
        const preciseButtons = visibleButtons.filter((info) => info.isPrecise);
        if (preciseButtons.length > 0) {
          indicator.textContent = `정밀 선택자 버튼 클릭 중... (${clickCount})`;
          console.log("정밀 선택자 버튼 클릭:", preciseButtons[0].selector);
          triggerButtonClick(preciseButtons[0]);
        } else {
          indicator.textContent = `버튼 클릭 중... (${clickCount})`;
          console.log("일반 버튼 클릭:", visibleButtons[0].selector);
          triggerButtonClick(visibleButtons[0]);
        }

        setTimeout(processNext, 2000);
        return true;
      }

      // 화면에 보이는 버튼이 없으면 첫 번째 버튼으로 스크롤
      scrollCount++;
      indicator.textContent = `버튼으로 스크롤 중... (${scrollCount})`;
      console.log("버튼으로 스크롤:", buttons[0].selector);

      buttons[0].button.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(processNext, 1500);
      return true;
    };

    // 일반 페이지 스크롤
    const scrollPageDown = () => {
      scrollCount++;
      indicator.textContent = `페이지 스크롤 중... (${scrollCount})`;

      // 이전 스크롤 위치 저장
      const beforeScroll = window.scrollY;

      // 페이지 아래로 스크롤
      window.scrollBy({
        top: window.innerHeight * 0.7,
        behavior: "smooth",
      });

      // 약간 대기 후 스크롤이 실제로 이동했는지 확인
      setTimeout(() => {
        const afterScroll = window.scrollY;

        // 스크롤이 더 이상 움직이지 않으면 페이지 끝에 도달한 것
        if (Math.abs(afterScroll - beforeScroll) < 10 && scrollCount > 3) {
          noButtonsCount = 3; // 더 이상 진행하지 않도록 설정
        }

        processNext();
      }, 1200);

      return true;
    };

    // 다음 단계 처리
    const processNext = () => {
      // 최대 클릭 횟수 도달 체크
      if (clickCount >= maxClicks || scrollCount >= maxScrolls) {
        indicator.textContent = "최대 시도 횟수 도달, 완료";
        finishProcess();
        return;
      }

      // 버튼 찾기 및 처리
      const foundButtons = processButtons();

      if (!foundButtons) {
        // 버튼을 찾지 못했을 때
        noButtonsCount++;

        if (noButtonsCount < 3) {
          // 버튼을 찾을 때까지 페이지 스크롤 시도
          scrollPageDown();
        } else {
          // 여러 번 시도 후에도 버튼을 찾지 못하면 완료
          indicator.textContent = "더 이상 버튼을 찾을 수 없음, 완료";
          finishProcess();
        }
      }
    };

    // 작업 완료 및 정리
    const finishProcess = () => {
      setTimeout(() => {
        // 표시기 제거
        if (indicator.parentNode) {
          indicator.parentNode.removeChild(indicator);
        }

        // 페이지 상단으로 스크롤
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
          setTimeout(() => {
            resolve(clickCount);
          }, 500);
        }, 500);
      }, 1000);
    };

    // 처리 시작
    setTimeout(processNext, 800);
  });
}

// handleSelectorElementClick 함수 수정 - 정밀 선택자 생성 사용
function handleSelectorElementClick(event) {
  try {
    if (!isElementSelectionMode) return;

    // 이벤트 기본 동작 방지
    event.preventDefault();
    event.stopPropagation();

    // 클릭된 요소
    const clickedElement = event.target;

    // 생성할 선택자 유형이 'button'인 경우 정밀 선택자 사용
    let selector;
    if (elementSelectionType === "button") {
      // 상위 요소 경로를 포함하는 정밀 선택자 생성
      selector = generatePreciseSelector(clickedElement, elementSelectionType);
    } else {
      // 기존 선택자 생성 함수 사용
      selector = generateOptimalSelector(clickedElement, elementSelectionType);
    }

    console.log("생성된 선택자:", selector, "유형:", elementSelectionType);

    // 요소 정보 팝업 표시
    try {
      showTooltip(clickedElement, event);

      // 3초 후 말풍선 숨기기
      setTimeout(hideTooltip, 3000);
    } catch (tooltipError) {
      console.error("말풍선 표시 중 오류:", tooltipError);
    }

    // 선택자를 background로 전송 (팝업이 닫혀있을 수 있으므로)
    chrome.runtime.sendMessage(
      {
        action: "elementSelectorGenerated",
        selectionType: elementSelectionType,
        selector: selector,
      },
      function (response) {
        if (chrome.runtime.lastError) {
          console.log("메시지 전송 중 오류:", chrome.runtime.lastError.message);
        } else {
          console.log("선택자가 백그라운드로 전송됨", response);
        }
      },
    );

    // 피드백 제공
    showFeedback(clickedElement);

    // 선택 유형에 따른 알림 메시지 설정
    let message;
    if (elementSelectionType === "tag") {
      message = "태그 선택자로 추가되었습니다.";
    } else if (elementSelectionType === "container") {
      message = "컨테이너 선택자로 추가되었습니다.";
    } else if (elementSelectionType === "button") {
      message = "버튼 선택자로 추가되었습니다.";
    }

    // 화면 상단에 간단한 알림 표시
    showNotification(message);

    // 선택 모드 종료
    cleanupElementSelection();
  } catch (error) {
    console.error("handleSelectorElementClick 중 오류:", error);
    cleanupElementSelection();
  }
}

// 개선된 버튼 찾기 함수 - content.js에 추가
function findButtonsWithComplexSelector(selector) {
  try {
    console.log(`복잡한 선택자 처리 시작: ${selector}`);

    // 결과 저장할 배열
    const allMatchingElements = [];

    // 1. 전체 선택자로 먼저 시도
    try {
      const elements = document.querySelectorAll(selector);
      console.log(`전체 선택자(${selector})로 찾은 요소: ${elements.length}개`);

      if (elements.length > 0) {
        allMatchingElements.push(
          ...Array.from(elements).map((el) => ({
            element: el,
            type: "direct",
            clickable: isClickable(el),
          })),
        );
      }
    } catch (error) {
      console.log(`전체 선택자 오류, 부분 선택자 시도: ${error.message}`);
    }

    // 2. 선택자를 단계별로 나눠서 시도 (뒤에서부터)
    if (selector.includes(">")) {
      const parts = selector.split(">").map((p) => p.trim());
      console.log(`선택자 분할: ${parts.length}개 부분`);

      // 마지막 부분부터 시도 (가장 구체적인 요소)
      for (let i = parts.length - 1; i >= 0; i--) {
        const partSelector = parts[i];

        // 빈 부분 건너뛰기
        if (!partSelector) continue;

        try {
          // 각 부분 선택자로 요소 찾기
          const elements = document.querySelectorAll(partSelector);
          console.log(
            `부분 선택자(${partSelector})로 찾은 요소: ${elements.length}개`,
          );

          // 클릭 가능한 요소인지 확인하고 추가
          const validElements = Array.from(elements).filter((el) =>
            isClickable(el),
          );

          if (validElements.length > 0) {
            allMatchingElements.push(
              ...validElements.map((el) => ({
                element: el,
                type: "part",
                partSelector: partSelector,
              })),
            );
          }

          // 클릭 가능한 가장 가까운 부모 요소도 찾기
          Array.from(elements).forEach((el) => {
            const clickableParent = findClosestClickableParent(el);
            if (clickableParent && !validElements.includes(clickableParent)) {
              allMatchingElements.push({
                element: clickableParent,
                type: "parent",
                childSelector: partSelector,
              });
            }
          });
        } catch (error) {
          console.log(`부분 선택자 오류: ${error.message}`);
        }
      }
    }

    // 3. 애매한 선택자의 경우 포함된 클래스로 시도
    if (selector.includes(".")) {
      const classNames = selector.match(/\.[a-zA-Z0-9_-]+/g);

      if (classNames && classNames.length > 0) {
        console.log(`클래스 기반으로 시도: ${classNames.length}개 클래스`);

        // 각 클래스별로 요소 찾기
        for (const className of classNames) {
          try {
            const elements = document.querySelectorAll(className);
            console.log(
              `클래스(${className})로 찾은 요소: ${elements.length}개`,
            );

            // 클릭 가능한 요소 필터링
            const clickableElements = Array.from(elements).filter((el) =>
              isClickable(el),
            );

            if (clickableElements.length > 0) {
              allMatchingElements.push(
                ...clickableElements.map((el) => ({
                  element: el,
                  type: "class",
                  className: className,
                })),
              );
            }

            // 클릭 가능한 가장 가까운 부모 요소도 찾기
            Array.from(elements).forEach((el) => {
              const clickableParent = findClosestClickableParent(el);
              if (
                clickableParent &&
                !clickableElements.includes(clickableParent)
              ) {
                allMatchingElements.push({
                  element: clickableParent,
                  type: "class-parent",
                  childClass: className,
                });
              }
            });
          } catch (error) {
            console.log(`클래스 선택자 오류: ${error.message}`);
          }
        }
      }
    }

    // 결과 정리 (중복 제거)
    const uniqueElements = [];
    const seenElements = new Set();

    for (const item of allMatchingElements) {
      // 각 요소를 한 번만 추가
      if (!seenElements.has(item.element)) {
        seenElements.add(item.element);
        uniqueElements.push(item);
      }
    }

    console.log(`총 ${uniqueElements.length}개의 고유 요소 찾음`);

    // 우선순위에 따라 정렬
    uniqueElements.sort((a, b) => {
      // 직접 매칭이 최우선
      if (a.type === "direct" && b.type !== "direct") return -1;
      if (a.type !== "direct" && b.type === "direct") return 1;

      // 다음은 부분 선택자
      if (a.type === "part" && b.type !== "part") return -1;
      if (a.type !== "part" && b.type === "part") return 1;

      // 그 다음은 클래스
      if (a.type === "class" && b.type !== "class") return -1;
      if (a.type !== "class" && b.type === "class") return 1;

      // 부모 요소는 마지막
      return 0;
    });

    return uniqueElements.map((item) => item.element);
  } catch (error) {
    console.error("복잡한 선택자 처리 중 오류:", error);
    return [];
  }
}

// 요소가 클릭 가능한지 확인하는 함수
function isClickable(element) {
  try {
    if (!element) return false;

    // 기본적인 유효성 검사
    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    const isVisible =
      rect.width > 0 &&
      rect.height > 0 &&
      styles.display !== "none" &&
      styles.visibility !== "hidden" &&
      styles.opacity !== "0";

    if (!isVisible) return false;

    // 특정 태그명 검사
    const tagName = element.tagName.toLowerCase();
    if (["button", "a", "input", "select", "textarea"].includes(tagName)) {
      return !element.disabled;
    }

    // role 속성 검사
    const role = element.getAttribute("role");
    if (role && ["button", "link", "menuitem"].includes(role)) {
      return true;
    }

    // onClick 이벤트 또는 이벤트 리스너 확인
    if (element.onclick || element.getAttribute("onclick")) {
      return true;
    }

    // 커서 스타일 검사
    if (styles.cursor === "pointer") {
      return true;
    }

    // aria-* 속성 검사
    if (
      element.getAttribute("aria-haspopup") ||
      element.getAttribute("aria-expanded") ||
      element.getAttribute("aria-pressed")
    ) {
      return true;
    }

    // 클래스나 id에 button, btn 등의 키워드가 있는지 확인
    const classes = element.className || "";
    const id = element.id || "";
    const buttonTerms = ["btn", "button", "click", "submit", "more"];

    for (const term of buttonTerms) {
      if (
        classes.toLowerCase().includes(term) ||
        id.toLowerCase().includes(term)
      ) {
        return true;
      }
    }

    return false;
  } catch (e) {
    console.error("클릭 가능 여부 확인 중 오류:", e);
    return false;
  }
}

// 가장 가까운 클릭 가능한 부모 요소 찾기
function findClosestClickableParent(element) {
  let current = element.parentElement;
  let depth = 0;
  const maxDepth = 5; // 최대 5단계까지만 올라감

  while (current && depth < maxDepth) {
    if (isClickable(current)) {
      return current;
    }
    current = current.parentElement;
    depth++;
  }

  return null;
}

// 개선된 버튼 찾기 함수 - content.js에 추가
function findButtonsWithComplexSelector(selector) {
  try {
    console.log(`복잡한 선택자 처리 시작: ${selector}`);

    // 결과 저장할 배열
    const allMatchingElements = [];

    // 1. 전체 선택자로 먼저 시도
    try {
      const elements = document.querySelectorAll(selector);
      console.log(`전체 선택자(${selector})로 찾은 요소: ${elements.length}개`);

      if (elements.length > 0) {
        allMatchingElements.push(
          ...Array.from(elements).map((el) => ({
            element: el,
            type: "direct",
            clickable: isClickable(el),
          })),
        );
      }
    } catch (error) {
      console.log(`전체 선택자 오류, 부분 선택자 시도: ${error.message}`);
    }

    // 2. 선택자를 단계별로 나눠서 시도 (뒤에서부터)
    if (selector.includes(">")) {
      const parts = selector.split(">").map((p) => p.trim());
      console.log(`선택자 분할: ${parts.length}개 부분`);

      // 마지막 부분부터 시도 (가장 구체적인 요소)
      for (let i = parts.length - 1; i >= 0; i--) {
        const partSelector = parts[i];

        // 빈 부분 건너뛰기
        if (!partSelector) continue;

        try {
          // 각 부분 선택자로 요소 찾기
          const elements = document.querySelectorAll(partSelector);
          console.log(
            `부분 선택자(${partSelector})로 찾은 요소: ${elements.length}개`,
          );

          // 클릭 가능한 요소인지 확인하고 추가
          const validElements = Array.from(elements).filter((el) =>
            isClickable(el),
          );

          if (validElements.length > 0) {
            allMatchingElements.push(
              ...validElements.map((el) => ({
                element: el,
                type: "part",
                partSelector: partSelector,
              })),
            );
          }

          // 클릭 가능한 가장 가까운 부모 요소도 찾기
          Array.from(elements).forEach((el) => {
            const clickableParent = findClosestClickableParent(el);
            if (clickableParent && !validElements.includes(clickableParent)) {
              allMatchingElements.push({
                element: clickableParent,
                type: "parent",
                childSelector: partSelector,
              });
            }
          });
        } catch (error) {
          console.log(`부분 선택자 오류: ${error.message}`);
        }
      }
    }

    // 3. 애매한 선택자의 경우 포함된 클래스로 시도
    if (selector.includes(".")) {
      const classNames = selector.match(/\.[a-zA-Z0-9_-]+/g);

      if (classNames && classNames.length > 0) {
        console.log(`클래스 기반으로 시도: ${classNames.length}개 클래스`);

        // 각 클래스별로 요소 찾기
        for (const className of classNames) {
          try {
            const elements = document.querySelectorAll(className);
            console.log(
              `클래스(${className})로 찾은 요소: ${elements.length}개`,
            );

            // 클릭 가능한 요소 필터링
            const clickableElements = Array.from(elements).filter((el) =>
              isClickable(el),
            );

            if (clickableElements.length > 0) {
              allMatchingElements.push(
                ...clickableElements.map((el) => ({
                  element: el,
                  type: "class",
                  className: className,
                })),
              );
            }

            // 클릭 가능한 가장 가까운 부모 요소도 찾기
            Array.from(elements).forEach((el) => {
              const clickableParent = findClosestClickableParent(el);
              if (
                clickableParent &&
                !clickableElements.includes(clickableParent)
              ) {
                allMatchingElements.push({
                  element: clickableParent,
                  type: "class-parent",
                  childClass: className,
                });
              }
            });
          } catch (error) {
            console.log(`클래스 선택자 오류: ${error.message}`);
          }
        }
      }
    }

    // 결과 정리 (중복 제거)
    const uniqueElements = [];
    const seenElements = new Set();

    for (const item of allMatchingElements) {
      // 각 요소를 한 번만 추가
      if (!seenElements.has(item.element)) {
        seenElements.add(item.element);
        uniqueElements.push(item);
      }
    }

    console.log(`총 ${uniqueElements.length}개의 고유 요소 찾음`);

    // 우선순위에 따라 정렬
    uniqueElements.sort((a, b) => {
      // 직접 매칭이 최우선
      if (a.type === "direct" && b.type !== "direct") return -1;
      if (a.type !== "direct" && b.type === "direct") return 1;

      // 다음은 부분 선택자
      if (a.type === "part" && b.type !== "part") return -1;
      if (a.type !== "part" && b.type === "part") return 1;

      // 그 다음은 클래스
      if (a.type === "class" && b.type !== "class") return -1;
      if (a.type !== "class" && b.type === "class") return 1;

      // 부모 요소는 마지막
      return 0;
    });

    return uniqueElements.map((item) => item.element);
  } catch (error) {
    console.error("복잡한 선택자 처리 중 오류:", error);
    return [];
  }
}

// 요소가 클릭 가능한지 확인하는 함수
function isClickable(element) {
  try {
    if (!element) return false;

    // 기본적인 유효성 검사
    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    const isVisible =
      rect.width > 0 &&
      rect.height > 0 &&
      styles.display !== "none" &&
      styles.visibility !== "hidden" &&
      styles.opacity !== "0";

    if (!isVisible) return false;

    // 특정 태그명 검사
    const tagName = element.tagName.toLowerCase();
    if (["button", "a", "input", "select", "textarea"].includes(tagName)) {
      return !element.disabled;
    }

    // role 속성 검사
    const role = element.getAttribute("role");
    if (role && ["button", "link", "menuitem"].includes(role)) {
      return true;
    }

    // onClick 이벤트 또는 이벤트 리스너 확인
    if (element.onclick || element.getAttribute("onclick")) {
      return true;
    }

    // 커서 스타일 검사
    if (styles.cursor === "pointer") {
      return true;
    }

    // aria-* 속성 검사
    if (
      element.getAttribute("aria-haspopup") ||
      element.getAttribute("aria-expanded") ||
      element.getAttribute("aria-pressed")
    ) {
      return true;
    }

    // 클래스나 id에 button, btn 등의 키워드가 있는지 확인
    const classes = element.className || "";
    const id = element.id || "";
    const buttonTerms = ["btn", "button", "click", "submit", "more"];

    for (const term of buttonTerms) {
      if (
        classes.toLowerCase().includes(term) ||
        id.toLowerCase().includes(term)
      ) {
        return true;
      }
    }

    return false;
  } catch (e) {
    console.error("클릭 가능 여부 확인 중 오류:", e);
    return false;
  }
}

// 가장 가까운 클릭 가능한 부모 요소 찾기
function findClosestClickableParent(element) {
  let current = element.parentElement;
  let depth = 0;
  const maxDepth = 5; // 최대 5단계까지만 올라감

  while (current && depth < maxDepth) {
    if (isClickable(current)) {
      return current;
    }
    current = current.parentElement;
    depth++;
  }

  return null;
}
