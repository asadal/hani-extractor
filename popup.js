let isExtracting = false;
let extractedItems = [];
let enableAreaSelection = false;

// 안전한 탭 메시지 전송 함수
function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, message, function (response) {
        if (chrome.runtime.lastError) {
          console.log("탭 메시지 오류:", chrome.runtime.lastError.message);
          resolve(null); // 오류를 거부하지 않고 null로 해결
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      console.error("탭 메시지 예외:", error);
      resolve(null);
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  // 기본 요소
  const toggleExtractBtn = document.getElementById("toggleExtract");
  const clearAllBtn = document.getElementById("clearAll");
  const saveTextBtn = document.getElementById("saveText");
  const statusSpan = document.getElementById("status");
  const extractedTextContainer = document.getElementById("extractedText");

  // 탭 관련 요소
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  // 검색 및 필터링 요소
  const searchInput = document.getElementById("searchInput");
  const filterSelect = document.getElementById("filterSelect");

  // 내보내기 요소
  const exportFormat = document.getElementById("exportFormat");
  const copyToClipboard = document.getElementById("copyToClipboard");

  // 자동 추출 요소
  const autoExtractTags = document.getElementById("autoExtractTags");
  const containerSelector = document.getElementById("containerSelector");
  const autoExtractBtn = document.getElementById("autoExtractBtn");
  const selectTagBtn = document.getElementById("selectTagBtn");
  const selectContainerBtn = document.getElementById("selectContainerBtn");

  // 선택 추출 요소
  const enableAreaSelectionCheckbox = document.getElementById(
    "enableAreaSelection",
  );

  // 팝업이 열릴 때마다 스토리지에서 대기 중인 선택자가 있는지 확인
  function checkPendingSelector() {
    chrome.storage.local.get(
      ["selectorPending", "lastSelectedSelector", "lastSelectionType"],
      function (result) {
        if (chrome.runtime.lastError) {
          console.error(
            "스토리지 접근 오류:",
            chrome.runtime.lastError.message,
          );
          return;
        }

        // 대기 중인 선택자가 있으면 처리
        if (result.selectorPending && result.lastSelectedSelector) {
          console.log("대기 중인 선택자 발견:", result.lastSelectedSelector);

          if (result.lastSelectionType === "tag") {
            // 태그 선택자 필드에 추가
            const currentValue = autoExtractTags.value.trim();
            const newSelector = result.lastSelectedSelector.trim();

            if (currentValue) {
              // 이미 값이 있으면 쉼표로 구분해서 추가
              autoExtractTags.value = currentValue + ", " + newSelector;
            } else {
              // 값이 없으면 그대로 설정
              autoExtractTags.value = newSelector;
            }

            // 설정 저장
            chrome.storage.local.set({
              autoExtractTags: autoExtractTags.value,
            });
          } else if (result.lastSelectionType === "container") {
            // 컨테이너 선택자 필드에 설정
            containerSelector.value = result.lastSelectedSelector.trim();

            // 설정 저장
            chrome.storage.local.set({
              containerSelector: containerSelector.value,
            });
          }

          // 처리 완료 후 플래그 초기화
          chrome.storage.local.set({ selectorPending: false });

          // 선택 완료 알림
          alert(
            `선택자가 성공적으로 추가되었습니다: ${result.lastSelectedSelector}`,
          );
        }
      },
    );
  }

  // 팝업이 열릴 때마다 실행
  checkPendingSelector();

  // 탭 전환 기능
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab;

      // 모든 탭 비활성화
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      // 선택된 탭 활성화
      button.classList.add("active");
      document.getElementById(`${tabName}Tab`).classList.add("active");
    });
  });

  // 저장된 데이터 불러오기
  chrome.storage.local.get(
    [
      "extractedItems",
      "isExtracting",
      "enableAreaSelection",
      "autoExtractTags",
      "containerSelector",
    ],
    function (result) {
      if (chrome.runtime.lastError) {
        console.error("스토리지 접근 오류:", chrome.runtime.lastError.message);
        return;
      }

      if (result.extractedItems) extractedItems = result.extractedItems;
      if (result.isExtracting !== undefined) isExtracting = result.isExtracting;
      if (result.enableAreaSelection !== undefined)
        enableAreaSelection = result.enableAreaSelection;

      // UI 업데이트
      updateExtractedTextDisplay();
      updateToggleButton();

      // 설정값 업데이트
      if (result.autoExtractTags)
        autoExtractTags.value = result.autoExtractTags;
      if (result.containerSelector)
        containerSelector.value = result.containerSelector;
      enableAreaSelectionCheckbox.checked = enableAreaSelection;
    },
  );

  // 추출 시작/종료 버튼
  // toggleExtractBtn의 클릭 이벤트 핸들러 부분 수정
  toggleExtractBtn.addEventListener("click", function () {
    isExtracting = !isExtracting;
    chrome.storage.local.set({ isExtracting: isExtracting });

    // 현재 활성 탭에 메시지 전송
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs.length > 0) {
        // background 스크립트를 통해 content script 로드 확인
        chrome.runtime.sendMessage(
          {
            action: "ensureContentScriptLoaded",
            tabId: tabs[0].id,
          },
          function (result) {
            if (chrome.runtime.lastError) {
              console.log(
                "Background와 통신할 수 없습니다:",
                chrome.runtime.lastError.message,
              );
              return;
            }

            if (result && result.success) {
              // 이제 content script가 로드되었으므로 메시지 전송 시도
              chrome.tabs.sendMessage(
                tabs[0].id,
                {
                  action: isExtracting ? "startExtract" : "stopExtract",
                  enableAreaSelection: enableAreaSelection,
                },
                function (response) {
                  if (chrome.runtime.lastError) {
                    console.log(
                      "탭과 연결할 수 없습니다. 이는 정상적인 동작일 수 있습니다:",
                      chrome.runtime.lastError.message,
                    );
                    // 오류가 발생해도 계속 진행 - 사용자에게 명시적 오류 표시 안함
                  } else {
                    console.log("탭 응답:", response);
                  }
                },
              );
            } else {
              console.log(
                "Content script를 로드할 수 없습니다:",
                result ? result.error : "알 수 없는 오류",
              );
              alert(
                "현재 페이지에서 확장 프로그램을 로드할 수 없습니다. 페이지를 새로고침하고 다시 시도해보세요.",
              );
            }
          },
        );
      }
    });

    updateToggleButton();
  });

  // 모두 지우기 버튼
  clearAllBtn.addEventListener("click", function () {
    extractedItems = [];
    chrome.storage.local.set({ extractedItems: [] });
    updateExtractedTextDisplay();
  });

  // 저장 버튼
  saveTextBtn.addEventListener("click", function () {
    saveExtractedText(exportFormat.value);
  });

  // 클립보드에 복사 버튼
  copyToClipboard.addEventListener("click", function () {
    copyTextToClipboard();
  });
  // 검색 기능
  searchInput.addEventListener("input", function () {
    updateExtractedTextDisplay();
  });

  // 필터링 기능
  filterSelect.addEventListener("change", function () {
    updateExtractedTextDisplay();
  });

  // 영역 선택 활성화 설정
  enableAreaSelectionCheckbox.addEventListener("change", function () {
    enableAreaSelection = this.checked;
    chrome.storage.local.set({ enableAreaSelection: enableAreaSelection });

    // 현재 활성 탭에 메시지 전송
    if (isExtracting) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs.length > 0) {
          try {
            chrome.tabs.sendMessage(
              tabs[0].id,
              {
                action: "updateSettings",
                enableAreaSelection: enableAreaSelection,
              },
              function (response) {
                if (chrome.runtime.lastError) {
                  console.log(
                    "탭과 연결할 수 없습니다:",
                    chrome.runtime.lastError.message,
                  );
                }
              },
            );
          } catch (error) {
            console.error("탭 통신 오류:", error);
          }
        }
      });
    }
  });

  // 자동 추출 태그 설정
  autoExtractTags.addEventListener("change", function () {
    chrome.storage.local.set({ autoExtractTags: this.value });
  });

  // 컨테이너 선택자 설정
  containerSelector.addEventListener("change", function () {
    chrome.storage.local.set({ containerSelector: this.value });
  });

  // 태그 선택 버튼
  selectTagBtn.addEventListener("click", function () {
    startElementSelection("tag");
  });

  // 컨테이너 선택 버튼
  selectContainerBtn.addEventListener("click", function () {
    startElementSelection("container");
  });

  // 태그 지우기 버튼
  document
    .getElementById("clearTagsBtn")
    .addEventListener("click", function () {
      // 태그 입력 필드 비우기 및 변경사항 저장
      autoExtractTags.value = "";
      chrome.storage.local.set({ autoExtractTags: "" });
    });

  // 컨테이너 지우기 버튼
  document
    .getElementById("clearContainerBtn")
    .addEventListener("click", function () {
      // 컨테이너 선택자 입력 필드 비우기 및 변경사항 저장
      containerSelector.value = "";
      chrome.storage.local.set({ containerSelector: "" });
    });

  // 요소 선택 모드 시작 함수
  function startElementSelection(type) {
    // 현재 활성화된 탭에 메시지 전송
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs.length > 0) {
        chrome.runtime.sendMessage(
          {
            action: "ensureContentScriptLoaded",
            tabId: tabs[0].id,
          },
          function (result) {
            if (chrome.runtime.lastError) {
              console.error(
                "Background와 통신할 수 없습니다:",
                chrome.runtime.lastError.message,
              );
              return;
            }

            if (result && result.success) {
              // content script가 로드되었으므로 메시지 전송
              chrome.tabs.sendMessage(
                tabs[0].id,
                {
                  action: "startElementSelection",
                  selectionType: type,
                },
                function (response) {
                  if (chrome.runtime.lastError) {
                    console.log(
                      "탭과 연결할 수 없습니다:",
                      chrome.runtime.lastError.message,
                    );
                  } else {
                    console.log("요소 선택 시작:", response);

                    // 사용자에게 안내 메시지 표시
                    if (type === "tag") {
                      alert(
                        "추출할 태그로 사용할 요소를 클릭하세요. 선택 후 팝업 창을 다시 열어주세요.",
                      );
                    } else {
                      alert(
                        "컨테이너 선택자로 사용할 요소를 클릭하세요. 선택 후 팝업 창을 다시 열어주세요.",
                      );
                    }

                    // 팝업 창을 닫아 웹 페이지와 상호작용할 수 있게 함
                    window.close();
                  }
                },
              );
            } else {
              console.error(
                "Content script를 로드할 수 없습니다:",
                result ? result.error : "알 수 없는 오류",
              );
            }
          },
        );
      }
    });
  }

  // 자동 추출 실행
  autoExtractBtn.addEventListener("click", function () {
    // 버튼을 일시적으로 비활성화하여 연속 클릭 방지
    autoExtractBtn.disabled = true;

    const tags = autoExtractTags.value.trim();
    const container = containerSelector.value.trim();

    if (!tags && !container) {
      alert("추출할 태그나 컨테이너 선택자를 입력해주세요.");
      autoExtractBtn.disabled = false;
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs.length > 0) {
        // background를 통해 content script가 로드되었는지 확인하고 필요하면 로드
        chrome.runtime.sendMessage(
          {
            action: "ensureContentScriptLoaded",
            tabId: tabs[0].id,
          },
          function (result) {
            if (chrome.runtime.lastError) {
              console.error(
                "Background와 통신할 수 없습니다:",
                chrome.runtime.lastError.message,
              );
              autoExtractBtn.disabled = false;
              return;
            }

            if (result && result.success) {
              // content script가 로드되었으므로 메시지 전송
              chrome.tabs.sendMessage(
                tabs[0].id,
                {
                  action: "autoExtract",
                  tags: tags,
                  container: container,
                },
                function (response) {
                  if (chrome.runtime.lastError) {
                    console.log(
                      "탭과 연결할 수 없습니다:",
                      chrome.runtime.lastError.message,
                    );
                  } else {
                    console.log("자동 추출 응답:", response);
                  }

                  // 작업 완료 후 버튼 다시 활성화
                  setTimeout(() => {
                    autoExtractBtn.disabled = false;
                  }, 2000);
                },
              );
            } else {
              console.error(
                "Content script를 로드할 수 없습니다:",
                result ? result.error : "알 수 없는 오류",
              );
              autoExtractBtn.disabled = false;
            }
          },
        );
      } else {
        autoExtractBtn.disabled = false;
      }
    });
  });
  // 상태 업데이트 함수
  function updateToggleButton() {
    if (isExtracting) {
      toggleExtractBtn.textContent = "추출 중지";
      toggleExtractBtn.classList.add("active");
      statusSpan.textContent = "활성화됨";
      statusSpan.className = "active";
    } else {
      toggleExtractBtn.textContent = "추출 시작";
      toggleExtractBtn.classList.remove("active");
      statusSpan.textContent = "비활성화됨";
      statusSpan.className = "inactive";
    }
  }

  // 추출된 텍스트 표시 업데이트
  function updateExtractedTextDisplay() {
    extractedTextContainer.innerHTML = "";

    if (extractedItems.length === 0) {
      // 변경: 명시적인 메시지 대신 placeholder 요소 사용
      const placeholder = document.createElement("div");
      placeholder.className = "placeholder-message";
      placeholder.textContent =
        "추출된 텍스트가 없습니다. 웹페이지에서 요소를 클릭하여 텍스트를 추출하세요.";
      extractedTextContainer.appendChild(placeholder);
      return;
    }

    // 검색어 및 필터링 조건 가져오기
    const searchTerm = searchInput.value.toLowerCase();
    const filterType = filterSelect.value;

    // 아이템 필터링 및 표시
    const filteredItems = extractedItems.filter((item) => {
      // 검색어 필터링
      const textMatch = item.text.toLowerCase().includes(searchTerm);
      const infoMatch = item.elementInfo.toLowerCase().includes(searchTerm);
      const contentMatch = textMatch || infoMatch;

      if (!contentMatch) return false;

      // 요소 유형 필터링
      if (filterType === "all") return true;
      if (filterType === "tag" && item.tagName) return true;
      if (filterType === "class" && item.elementInfo.includes(".")) return true;
      if (filterType === "id" && item.elementInfo.includes("#")) return true;

      return false;
    });

    filteredItems.forEach((item, index) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "text-item";

      const elementInfoDiv = document.createElement("div");
      elementInfoDiv.className = "element-info";

      const elementInfoText = document.createElement("span");
      elementInfoText.textContent = item.elementInfo;

      const elementMeta = document.createElement("div");
      elementMeta.className = "element-meta";

      if (item.tagName) {
        const tagSpan = document.createElement("span");
        tagSpan.className = "element-tag";
        tagSpan.textContent = item.tagName;
        elementMeta.appendChild(tagSpan);
      }

      elementInfoDiv.appendChild(elementInfoText);
      elementInfoDiv.appendChild(elementMeta);

      const textContentDiv = document.createElement("div");
      textContentDiv.className = "text-content";

      // 검색어 하이라이팅
      if (searchTerm) {
        const highlightedText = item.text.replace(
          new RegExp(searchTerm, "gi"),
          (match) => `<span class="highlight">${match}</span>`,
        );
        textContentDiv.innerHTML = highlightedText;
      } else {
        textContentDiv.textContent = item.text;
      }

      itemDiv.appendChild(elementInfoDiv);
      itemDiv.appendChild(textContentDiv);
      extractedTextContainer.appendChild(itemDiv);
    });

    if (filteredItems.length === 0) {
      extractedTextContainer.innerHTML =
        '<p class="empty-message">검색 조건에 맞는 내용이 없습니다.</p>';
    }
  }

  // 텍스트 저장 함수
  function saveExtractedText(format) {
    if (extractedItems.length === 0) {
      alert("저장할 텍스트가 없습니다.");
      return;
    }

    let content;
    let mimeType;
    let extension;

    // 검색어 및 필터링 조건 적용
    const searchTerm = searchInput.value.toLowerCase();
    const filterType = filterSelect.value;

    // 아이템 필터링
    const filteredItems = extractedItems.filter((item) => {
      // 검색어 필터링
      const textMatch = item.text.toLowerCase().includes(searchTerm);
      const infoMatch = item.elementInfo.toLowerCase().includes(searchTerm);
      const contentMatch = textMatch || infoMatch;

      if (!contentMatch) return false;

      // 요소 유형 필터링
      if (filterType === "all") return true;
      if (filterType === "tag" && item.tagName) return true;
      if (filterType === "class" && item.elementInfo.includes(".")) return true;
      if (filterType === "id" && item.elementInfo.includes("#")) return true;

      return false;
    });

    // 텍스트만 추출
    const textOnly = filteredItems.map((item) => item.text).join("\n\n");

    switch (format) {
      case "txt":
        content = textOnly;
        mimeType = "text/plain";
        extension = "txt";
        break;

      case "csv":
        content = "Text\n";
        content += filteredItems
          .map((item) => {
            // CSV 형식에 맞게 콤마와 줄바꿈 처리
            const escapedText = `"${item.text.replace(/"/g, '""').replace(/\n/g, " ")}"`;
            return escapedText;
          })
          .join("\n");
        mimeType = "text/csv";
        extension = "csv";
        break;

      case "json":
        content = JSON.stringify(
          filteredItems.map((item) => ({ text: item.text })),
          null,
          2,
        );
        mimeType = "application/json";
        extension = "json";
        break;

      case "html":
        content = `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Hani Extractor 추출 결과</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
      .text-content { font-size: 14px; line-height: 1.5; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
    </style>
  </head>
  <body>
    <h1>추출된 텍스트</h1>
    <div class="extracted-container">
  `;

        filteredItems.forEach((item) => {
          content += `    <div class="text-content">${item.text}</div>\n`;
        });

        content += `  </div>
  </body>
  </html>`;
        mimeType = "text/html";
        extension = "html";
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    // 현재 탭의 제목 가져오기 - 수정된 부분
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      let filename;

      // 디버깅을 위해 탭 정보 로깅
      console.log("현재 탭 정보:", tabs);

      try {
        if (tabs && tabs.length > 0 && tabs[0].title) {
          // 탭 제목에서 파일명으로 사용할 수 없는 문자 제거
          let sanitizedTitle = tabs[0].title
            .replace(/[\\/:*?"<>|]/g, "_")
            .trim();

          // 공백이 연속으로 있으면 하나로 줄이기
          sanitizedTitle = sanitizedTitle.replace(/\s+/g, " ");

          // 파일명이 너무 길면 자르기
          if (sanitizedTitle.length > 50) {
            sanitizedTitle = sanitizedTitle.substring(0, 47) + "...";
          }

          filename = `${sanitizedTitle}.${extension}`;
          console.log("생성된 파일명:", filename);
        } else {
          // 제목을 가져올 수 없는 경우 기본 이름 사용
          const timestamp = new Date()
            .toISOString()
            .replace(/:/g, "-")
            .replace(/\..+/, "");
          filename = `hani-extractor-${timestamp}.${extension}`;
          console.log("기본 파일명 사용:", filename);
        }
      } catch (error) {
        console.error("파일명 생성 중 오류:", error);
        const timestamp = new Date()
          .toISOString()
          .replace(/:/g, "-")
          .replace(/\..+/, "");
        filename = `hani-extractor-${timestamp}.${extension}`;
      }

      // 다운로드 실행
      try {
        chrome.downloads.download(
          {
            url: url,
            filename: filename,
            saveAs: true,
          },
          function (downloadId) {
            if (chrome.runtime.lastError) {
              console.error("다운로드 중 오류:", chrome.runtime.lastError);
              alert(
                `파일 저장 중 오류가 발생했습니다: ${chrome.runtime.lastError.message}`,
              );
            } else {
              console.log("다운로드 시작됨. ID:", downloadId);
            }
          },
        );
      } catch (error) {
        console.error("다운로드 시작 중 오류:", error);
        alert("파일 저장을 시작할 수 없습니다.");
      }
    });
  }

  // 클립보드에 복사 함수
  function copyTextToClipboard() {
    if (extractedItems.length === 0) {
      alert("복사할 텍스트가 없습니다.");
      return;
    }

    // 검색어 및 필터링 조건 적용
    const searchTerm = searchInput.value.toLowerCase();
    const filterType = filterSelect.value;

    // 아이템 필터링
    const filteredItems = extractedItems.filter((item) => {
      // 검색어 필터링
      const textMatch = item.text.toLowerCase().includes(searchTerm);
      const infoMatch = item.elementInfo.toLowerCase().includes(searchTerm);
      const contentMatch = textMatch || infoMatch;

      if (!contentMatch) return false;

      // 요소 유형 필터링
      if (filterType === "all") return true;
      if (filterType === "tag" && item.tagName) return true;
      if (filterType === "class" && item.elementInfo.includes(".")) return true;
      if (filterType === "id" && item.elementInfo.includes("#")) return true;

      return false;
    });

    // 텍스트만 추출해서 붙여넣기
    const textContent = filteredItems.map((item) => item.text).join("\n\n");

    navigator.clipboard
      .writeText(textContent)
      .then(() => {
        alert("클립보드에 복사되었습니다.");
      })
      .catch((err) => {
        console.error("클립보드 복사 실패:", err);
        alert("클립보드에 복사하지 못했습니다.");
      });
  }

  // 메시지 리스너
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      console.log("팝업에서 메시지 수신:", request);

      // 처리된 메시지 ID를 추적하는 변수 추가
      if (!window.processedMessageIds) {
        window.processedMessageIds = new Set();
      }

      // 메시지에 ID 추가
      const messageId =
        request.messageId ||
        `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // 이미 처리한 메시지인지 확인
      if (window.processedMessageIds.has(messageId)) {
        console.log("이미 처리된 메시지입니다. 건너뜁니다:", messageId);
        sendResponse({ status: "already-processed" });
        return true;
      }

      // 처리된 메시지 ID 추가
      window.processedMessageIds.add(messageId);

      // 지나치게 많은 메시지 ID가 쌓이는 것을 방지
      if (window.processedMessageIds.size > 100) {
        // 가장 오래된 것부터 50개 제거 (단순 구현)
        const idsToKeep = Array.from(window.processedMessageIds).slice(-50);
        window.processedMessageIds = new Set(idsToKeep);
      }

      if (request.action === "newTextExtracted") {
        extractedItems.push(request.data);
        chrome.storage.local.set({ extractedItems: extractedItems });
        updateExtractedTextDisplay();
        sendResponse({ status: "success" });
      } else if (request.action === "bulkTextExtracted") {
        // 업데이트 전에 현재 항목 수를 기록
        const previousCount = extractedItems.length;

        // 새 항목 추가
        extractedItems = [...extractedItems, ...request.data];
        chrome.storage.local.set({ extractedItems: extractedItems });
        updateExtractedTextDisplay();

        // 자동 추출 완료 알림 (새 항목 수 표시)
        const newItemsCount = extractedItems.length - previousCount;
        alert(`${newItemsCount}개의 요소가 추출되었습니다.`);
        sendResponse({ status: "success" });
      } else if (request.action === "extractionError") {
        alert(request.data.message);
        sendResponse({ status: "error-acknowledged" });
      } else if (request.action === "elementSelectorGenerated") {
        if (request.selectionType === "tag") {
          // 태그 선택자 필드에 추가 (기존 값과 합치기)
          const currentValue = autoExtractTags.value.trim();
          const newSelector = request.selector.trim();

          if (currentValue) {
            // 이미 값이 있으면 쉼표로 구분해서 추가
            autoExtractTags.value = currentValue + ", " + newSelector;
          } else {
            // 값이 없으면 그대로 설정
            autoExtractTags.value = newSelector;
          }

          // 설정 저장
          chrome.storage.local.set({ autoExtractTags: autoExtractTags.value });
        } else if (request.selectionType === "container") {
          // 컨테이너 선택자 필드에 설정
          containerSelector.value = request.selector.trim();

          // 설정 저장
          chrome.storage.local.set({
            containerSelector: containerSelector.value,
          });
        }

        sendResponse({ status: "success" });
      }

      return true; // 비동기 응답을 위해 true 반환
    },
  );
});
