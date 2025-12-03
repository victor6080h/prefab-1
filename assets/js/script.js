// ==========================================
// 품질관리 대시보드 시스템 - 공통 JavaScript
// ==========================================

// Report Management Keys
const REPORT_KEYS = {
    REPORTS_LIST: 'PREFAB_REPORTS_LIST',
    ACTIVE_REPORT: 'ACTIVE_REPORT_ID'
};

// LocalStorage 키 상수
const STORAGE_KEYS = {
    PROJECT_INFO: 'qms_project_info',
    SURVEY_DATA: 'qms_survey_data',
    ACCELERATION_DATA: 'qms_acceleration_data',
    TILT_DATA: 'qms_tilt_data',
    STRAIN_DATA: 'qms_strain_data',
    FABRICATION_ERROR: 'qms_fabrication_error',
    PHOTOS: 'qms_photos',
    ACCEL_GRAPH_IMAGE: 'qms_accel_graph_image',
    TILT_GRAPH_IMAGE: 'qms_tilt_graph_image',
    STRAIN_GRAPH_IMAGE: 'qms_strain_graph_image',
    ERROR_CHART_IMAGE: 'qms_error_chart_image'
};

// Track freshly selected images to prevent loadSavedImage from overwriting them
// Key: previewId, Value: timestamp of selection
const freshlySelectedImages = {};

// Clear stale entries from freshlySelectedImages (older than 30 seconds)
setInterval(function() {
    const now = Date.now();
    for (const key in freshlySelectedImages) {
        if (now - freshlySelectedImages[key] > 30000) {
            delete freshlySelectedImages[key];
            console.log('🧹 오래된 이미지 선택 추적 정리:', key);
        }
    }
}, 30000); // Check every 30 seconds

// ==========================================
// Report ID Management
// ==========================================

/**
 * Get active report ID
 * @returns {string|null} Active report ID or null
 */
function getActiveReportId() {
    return localStorage.getItem(REPORT_KEYS.ACTIVE_REPORT);
}

/**
 * Ensure there is an active report, create default if needed
 * @returns {string} Active report ID
 */
function ensureActiveReport() {
    let reportId = getActiveReportId();
    
    if (!reportId) {
        // Create a default report
        reportId = 'REPORT_' + Date.now();
        localStorage.setItem(REPORT_KEYS.ACTIVE_REPORT, reportId);
        
        // Add to reports list
        const reportsList = JSON.parse(localStorage.getItem(REPORT_KEYS.REPORTS_LIST) || '[]');
        reportsList.push({
            id: reportId,
            projectName: '기본 보고서',
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        });
        localStorage.setItem(REPORT_KEYS.REPORTS_LIST, JSON.stringify(reportsList));
        
        console.log('✅ 기본 보고서 생성:', reportId);
    }
    
    return reportId;
}

/**
 * Get report-specific storage key with prefix
 * @param {string} baseKey - Base storage key
 * @returns {string} Report-specific storage key
 */
function getReportStorageKey(baseKey) {
    // Ensure active report exists
    const reportId = ensureActiveReport();
    return `REPORT_${reportId}_${baseKey}`;
}

/**
 * Update last modified timestamp for active report
 */
function updateReportTimestamp() {
    const reportId = getActiveReportId();
    if (!reportId) return;
    
    try {
        const reportsList = JSON.parse(localStorage.getItem(REPORT_KEYS.REPORTS_LIST) || '[]');
        const report = reportsList.find(r => r.id === reportId);
        if (report) {
            report.lastModified = new Date().toISOString();
            localStorage.setItem(REPORT_KEYS.REPORTS_LIST, JSON.stringify(reportsList));
        }
    } catch (e) {
        console.error('Failed to update report timestamp:', e);
    }
}

// ==========================================
// 이미지 리사이징 및 압축
// ==========================================

/**
 * 이미지를 목표 크기(110KB) 미만으로 자동 압축
 * @param {File} file - 원본 이미지 파일
 * @param {number} targetSizeKB - 목표 크기 (KB 단위, 기본값: 110)
 * @param {Function} successCallback - 성공 콜백 (압축된 Data URL 전달)
 * @param {Function} errorCallback - 실패 콜백
 */
function resizeAndCompressImage(file, targetSizeKB, quality, successCallback, errorCallback) {
    // targetSizeKB를 110KB로 고정
    const TARGET_SIZE_KB = 110;
    const TARGET_SIZE_BYTES = TARGET_SIZE_KB * 1024;
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const img = new Image();
        
        img.onload = function() {
            try {
                console.log('=== 자동 압축 시작 ===');
                console.log('원본 이미지 크기:', img.width, 'x', img.height);
                console.log('원본 파일 크기:', (file.size / 1024).toFixed(0), 'KB');
                console.log('목표 크기:', TARGET_SIZE_KB, 'KB');
                
                // 캔버스 생성
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 압축 시도 함수
                function tryCompress(width, height, quality) {
                    canvas.width = width;
                    canvas.height = height;
                    ctx.clearRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    const sizeKB = dataUrl.length / 1024;
                    
                    console.log(`시도: ${width}x${height}, 품질: ${(quality * 100).toFixed(0)}% → ${sizeKB.toFixed(0)}KB`);
                    
                    return {
                        dataUrl: dataUrl,
                        size: dataUrl.length,
                        sizeKB: sizeKB,
                        width: width,
                        height: height,
                        quality: quality
                    };
                }
                
                // 초기 크기와 품질 설정
                let currentWidth = img.width;
                let currentHeight = img.height;
                let currentQuality = 0.85;
                
                // 최대 시도 횟수 증가
                const MAX_ATTEMPTS = 30;
                let attempt = 0;
                let bestResult = null;
                
                // 최소 해상도 (가로세로 비율 고려)
                const aspectRatio = img.width / img.height;
                const MIN_PIXELS = 200 * 200; // 최소 픽셀 수
                
                // 반복 압축
                while (attempt < MAX_ATTEMPTS) {
                    attempt++;
                    
                    const result = tryCompress(currentWidth, currentHeight, currentQuality);
                    
                    // 목표 크기 이하이면 성공
                    if (result.size <= TARGET_SIZE_BYTES) {
                        bestResult = result;
                        console.log(`✅ 목표 달성! ${attempt}번 시도`);
                        break;
                    }
                    
                    // 최선의 결과 업데이트 (목표에 가장 가까운 것)
                    if (!bestResult || Math.abs(result.size - TARGET_SIZE_BYTES) < Math.abs(bestResult.size - TARGET_SIZE_BYTES)) {
                        bestResult = result;
                    }
                    
                    // 크기 비율 계산
                    const ratio = result.size / TARGET_SIZE_BYTES;
                    
                    // 현재 픽셀 수 계산
                    const currentPixels = currentWidth * currentHeight;
                    
                    // 해상도가 최소치보다 크면 계속 축소
                    if (currentPixels > MIN_PIXELS) {
                        if (ratio > 2.5) {
                            // 크기가 2.5배 이상 크면 해상도 대폭 감소
                            currentWidth = Math.floor(currentWidth * 0.65);
                            currentHeight = Math.floor(currentHeight * 0.65);
                        } else if (ratio > 2.0) {
                            // 크기가 2배 이상 크면 해상도 대폭 감소
                            currentWidth = Math.floor(currentWidth * 0.75);
                            currentHeight = Math.floor(currentHeight * 0.75);
                        } else if (ratio > 1.5) {
                            // 크기가 1.5배 이상 크면 해상도 감소
                            currentWidth = Math.floor(currentWidth * 0.85);
                            currentHeight = Math.floor(currentHeight * 0.85);
                        } else if (ratio > 1.2) {
                            // 크기가 1.2배 이상 크면 해상도 약간 감소
                            currentWidth = Math.floor(currentWidth * 0.92);
                            currentHeight = Math.floor(currentHeight * 0.92);
                        } else {
                            // 목표에 근접하면 품질만 조정
                            currentQuality = Math.max(0.3, currentQuality - 0.05);
                        }
                    } else {
                        // 최소 해상도 도달, 품질만 계속 낮춤
                        console.log('⚠️ 최소 해상도 도달, 품질 우선 압축');
                        currentQuality = Math.max(0.2, currentQuality - 0.05);
                        
                        // 품질이 너무 낮아지면 중단
                        if (currentQuality <= 0.2) {
                            console.log('⚠️ 최소 품질 도달, 압축 중단');
                            break;
                        }
                    }
                }
                
                if (!bestResult) {
                    throw new Error('압축 실패');
                }
                
                // 결과 로그
                const originalSizeKB = file.size / 1024;
                const finalSizeKB = bestResult.sizeKB;
                const compressionRatio = ((1 - bestResult.size / file.size) * 100).toFixed(1);
                
                console.log('=== 압축 완료 ===');
                console.log(`원본: ${originalSizeKB.toFixed(0)}KB (${img.width}x${img.height})`);
                console.log(`결과: ${finalSizeKB.toFixed(0)}KB (${bestResult.width}x${bestResult.height})`);
                console.log(`품질: ${(bestResult.quality * 100).toFixed(0)}%`);
                console.log(`압축률: ${compressionRatio}%`);
                console.log(`시도 횟수: ${attempt}회`);
                
                if (bestResult.sizeKB > TARGET_SIZE_KB) {
                    console.warn(`⚠️ 목표 크기(${TARGET_SIZE_KB}KB) 미달성, 최선의 결과: ${finalSizeKB.toFixed(0)}KB`);
                } else {
                    console.log(`✅ 목표 크기 달성! (${TARGET_SIZE_KB}KB 이하)`);
                }
                
                // 성공 콜백 호출 (목표 미달성이어도 최선의 결과 반환)
                successCallback(bestResult.dataUrl);
                
            } catch (error) {
                console.error('이미지 압축 오류:', error);
                errorCallback(error);
            }
        };
        
        img.onerror = function(error) {
            console.error('이미지 로드 오류:', error);
            errorCallback(error);
        };
        
        img.src = e.target.result;
    };
    
    reader.onerror = function(error) {
        console.error('파일 읽기 오류:', error);
        errorCallback(error);
    };
    
    reader.readAsDataURL(file);
}

// ==========================================
// 이미지 미리보기 기능
// ==========================================

/**
 * 이미지 미리보기 표시
 * @param {HTMLInputElement} input - 파일 입력 요소
 * @param {string} previewId - 미리보기 이미지 요소의 ID
 */
function previewImage(input, previewId) {
    console.log('=== previewImage 호출 ===');
    console.log('input:', input);
    console.log('previewId:', previewId);
    
    if (!input || !input.files || !input.files[0]) {
        console.error('파일이 선택되지 않았습니다.');
        return;
    }
    
    const preview = document.getElementById(previewId);
    if (!preview) {
        console.error('미리보기 요소를 찾을 수 없습니다:', previewId);
        return;
    }
    
    // preview 요소에서 가장 가까운 .photo-upload 컨테이너 찾기
    const container = preview.closest('.photo-upload');
    if (!container) {
        console.error('photo-upload 컨테이너를 찾을 수 없습니다:', previewId);
        return;
    }
    
    const placeholder = container.querySelector('.placeholder');
    
    const file = input.files[0];
    console.log('선택된 파일:', file.name, '크기:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    
    // 이미지 파일 타입 체크
    if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다.');
        input.value = '';
        return;
    }
    
    // 새 이미지 선택을 추적 (loadSavedImage가 이를 덮어쓰지 않도록)
    freshlySelectedImages[previewId] = Date.now();
    console.log('🔖 새 이미지 선택 마킹:', previewId);
    
    // 이미지 자동 리사이징 및 압축 (110KB 이하로 자동 압축)
    resizeAndCompressImage(file, 110, null, function(compressedDataUrl) {
        try {
            const compressedSizeKB = (compressedDataUrl.length / 1024).toFixed(0);
            
            preview.src = compressedDataUrl;
            preview.style.display = 'block';
            
            if (placeholder) {
                placeholder.style.display = 'none';
            }
            
            container.classList.add('has-image');
            
            // 압축된 이미지를 LocalStorage에 저장
            console.log('LocalStorage에 저장 시도:', previewId);
            saveImageToStorage(previewId, compressedDataUrl);
            
            console.log('✅ 이미지 업로드 성공:', previewId, `(${compressedSizeKB}KB)`);
        } catch (error) {
            console.error('❌ 이미지 처리 오류:', error);
            alert('이미지 처리 중 오류가 발생했습니다.');
        }
    }, function(error) {
        console.error('❌ 이미지 압축 오류:', error);
        alert('이미지 압축 중 오류가 발생했습니다. 다른 이미지를 선택해주세요.');
    });
}

/**
 * 이미지를 LocalStorage에 저장
 * @param {string} key - 저장 키
 * @param {string} imageData - Base64 인코딩된 이미지 데이터
 */
function saveImageToStorage(key, imageData) {
    try {
        console.log('=== saveImageToStorage 호출 ===');
        console.log('저장할 사진 ID:', key);
        console.log('이미지 데이터 크기:', (imageData.length / 1024).toFixed(2), 'KB');
        
        // 기존 저장된 사진 데이터 가져오기
        const photos = getFromStorage(STORAGE_KEYS.PHOTOS) || {};
        console.log('저장 전 사진 개수:', Object.keys(photos).length);
        console.log('저장 전 사진 ID 목록:', Object.keys(photos));
        
        // 새 사진 추가
        photos[key] = imageData;
        console.log('저장 후 사진 개수:', Object.keys(photos).length);
        console.log('저장 후 사진 ID 목록:', Object.keys(photos));
        
        // LocalStorage에 저장
        const saveResult = saveToStorage(STORAGE_KEYS.PHOTOS, photos);
        
        if (saveResult !== false) {
            console.log('✅ 이미지 저장 성공:', key);
            
            // 저장 확인
            const savedPhotos = getFromStorage(STORAGE_KEYS.PHOTOS);
            console.log('저장 확인 - 사진 개수:', Object.keys(savedPhotos).length);
            console.log('저장 확인 - 사진 ID 목록:', Object.keys(savedPhotos));
        } else {
            console.error('❌ 이미지 저장 실패:', key);
        }
    } catch (e) {
        console.error('이미지 저장 실패:', e);
        
        // LocalStorage 용량 초과 시
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            alert('저장공간이 부족합니다. 이미지 크기를 줄이거나 기존 데이터를 삭제해주세요.');
        } else {
            alert('이미지 저장 중 오류가 발생했습니다.');
        }
    }
}

/**
 * 저장된 이미지 로드
 * @param {string} previewId - 미리보기 이미지 요소의 ID
 */
function loadSavedImage(previewId) {
    try {
        console.log('이미지 로드 시도:', previewId);
        
        // 활성 리포트 ID 확인
        const reportId = getActiveReportId();
        if (!reportId) {
            console.warn('⚠️ 활성 리포트 ID가 없습니다. 이미지를 로드할 수 없습니다.');
            return;
        }
        
        const preview = document.getElementById(previewId);
        if (!preview) {
            console.error('미리보기 요소를 찾을 수 없습니다:', previewId);
            return;
        }
        
        // 최근 10초 이내에 새로 선택된 이미지는 로드하지 않음 (압축 진행 중이거나 막 선택한 경우)
        const freshlySelectedTime = freshlySelectedImages[previewId];
        if (freshlySelectedTime && (Date.now() - freshlySelectedTime < 10000)) {
            console.log('⏳ 최근에 새로 선택된 이미지입니다. 로드 건너뜀:', previewId);
            return;
        }
        
        // 이미 이미지가 표시되고 있으면 로드하지 않음 (사용자가 새로 선택한 경우)
        if (preview.style.display === 'block' && preview.src && preview.src !== window.location.href) {
            console.log('이미 이미지가 표시되어 있습니다. 로드 건너뜀:', previewId);
            return;
        }
        
        const photos = getFromStorage(STORAGE_KEYS.PHOTOS);
        console.log('저장된 사진 데이터:', photos ? Object.keys(photos) : 'null');
        
        if (!photos) {
            console.log('저장된 사진 데이터가 없습니다.');
            return;
        }
        
        if (!photos[previewId]) {
            console.log('해당 ID의 사진이 없습니다:', previewId);
            return;
        }

        console.log('이미지 로드 성공:', previewId, '(리포트:', reportId + ')', '크기:', (imageData.length / 1024).toFixed(2), 'KB');
        
        const container = preview.closest('.photo-upload');
        if (!container) {
            console.error('컨테이너를 찾을 수 없습니다:', previewId);
            return;
        }
        
        const placeholder = container.querySelector('.placeholder');
        
        // LocalStorage의 이미지와 현재 표시된 이미지가 다른 경우에만 로드
        const savedImageData = photos[previewId];
        if (preview.src === savedImageData) {
            console.log('이미 동일한 이미지가 표시되어 있습니다:', previewId);
            return;
        }
        
        // 이미지 데이터 설정
        preview.src = savedImageData;
        preview.style.display = 'block';
        
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        container.classList.add('has-image');
        
        console.log('✅ 저장된 이미지 로드 성공:', previewId);
    } catch (error) {
        console.error('❌ 이미지 로드 오류:', previewId, error);
    }
}

// ==========================================
// LocalStorage 관리
// ==========================================

/**
 * LocalStorage에 데이터 저장
 * @param {string} key - 저장 키
 * @param {*} data - 저장할 데이터
 */
function saveToStorage(key, data) {
    try {
        // Use report-specific key
        const storageKey = getReportStorageKey(key);
        localStorage.setItem(storageKey, JSON.stringify(data));
        
        // Update report timestamp
        updateReportTimestamp();
        
        return true;
    } catch (e) {
        console.error('저장 실패:', e);
        return false;
    }
}

/**
 * LocalStorage에서 데이터 가져오기
 * @param {string} key - 가져올 키
 * @returns {*} 저장된 데이터 또는 null
 */
function getFromStorage(key) {
    try {
        // Use report-specific key
        const storageKey = getReportStorageKey(key);
        const data = localStorage.getItem(storageKey);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('데이터 로드 실패:', e);
        return null;
    }
}

/**
 * LocalStorage 데이터 삭제
 * @param {string} key - 삭제할 키
 */
function removeFromStorage(key) {
    // Use report-specific key
    const storageKey = getReportStorageKey(key);
    localStorage.removeItem(storageKey);
}

/**
 * 모든 데이터 초기화
 */
function clearAllData() {
    const reportId = getActiveReportId();
    const message = reportId 
        ? '현재 보고서의 모든 데이터를 삭제하시겠습니까?' 
        : '모든 저장된 데이터를 삭제하시겠습니까?';
    
    if (confirm(message)) {
        Object.values(STORAGE_KEYS).forEach(key => {
            removeFromStorage(key);
        });
        alert('모든 데이터가 삭제되었습니다.');
        location.reload();
    }
}

// ==========================================
// 폼 데이터 자동 저장 및 로드
// ==========================================

/**
 * 폼 데이터 자동 저장
 * @param {string} formId - 폼 요소의 ID
 * @param {string} storageKey - LocalStorage 키
 */
function autoSaveForm(formId, storageKey) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    // 페이지 로드 직후의 change 이벤트 무시를 위한 플래그
    let isInitialLoad = true;
    
    // 100ms 후 초기 로드 완료로 간주
    setTimeout(() => {
        isInitialLoad = false;
        console.log('🔓 autoSaveForm 활성화:', formId);
    }, 100);
    
    // 폼 입력 변경 시 자동 저장
    form.addEventListener('change', function() {
        // 초기 로드 중에는 자동 저장하지 않음
        if (isInitialLoad) {
            console.log('⏸️  초기 로드 중 - 자동 저장 건너뜀:', formId);
            return;
        }
        
        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            if (data[key]) {
                // 같은 이름의 필드가 여러 개인 경우 배열로 저장
                if (Array.isArray(data[key])) {
                    data[key].push(value);
                } else {
                    data[key] = [data[key], value];
                }
            } else {
                data[key] = value;
            }
        }
        
        console.log('💾 autoSaveForm 자동 저장:', formId, data);
        saveToStorage(storageKey, data);
    });
}

/**
 * 저장된 폼 데이터 로드
 * @param {string} formId - 폼 요소의 ID
 * @param {string} storageKey - LocalStorage 키
 */
function loadFormData(formId, storageKey) {
    const form = document.getElementById(formId);
    const data = getFromStorage(storageKey);
    
    if (!form || !data) return;
    
    Object.keys(data).forEach(key => {
        const elements = form.elements[key];
        if (!elements) return;
        
        if (elements.type === 'radio' || elements.type === 'checkbox') {
            // 라디오 버튼이나 체크박스
            const value = data[key];
            if (Array.isArray(value)) {
                value.forEach(v => {
                    const el = form.querySelector(`[name="${key}"][value="${v}"]`);
                    if (el) el.checked = true;
                });
            } else {
                const el = form.querySelector(`[name="${key}"][value="${value}"]`);
                if (el) el.checked = true;
            }
        } else if (elements.length > 1) {
            // NodeList인 경우
            elements.forEach(el => {
                if (el.value === data[key]) {
                    el.checked = true;
                }
            });
        } else {
            // 일반 입력 필드
            elements.value = data[key];
        }
    });
}

// ==========================================
// 차트 그리기 함수 (간단한 구현)
// ==========================================

/**
 * 선 그래프 그리기
 * @param {string} canvasId - Canvas 요소의 ID
 * @param {Object} data - 그래프 데이터
 */
function drawLineChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const { labels, values, thresholds, title, yLabel } = data;
    
    // Canvas 크기 설정
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const padding = 60;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;
    
    // 배경
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 최대/최소값 계산
    const allValues = [...values];
    if (thresholds) {
        allValues.push(...Object.values(thresholds));
    }
    const maxValue = Math.max(...allValues) * 1.2;
    const minValue = Math.min(...allValues, 0) * 1.2;
    const valueRange = maxValue - minValue;
    
    // 격자선 그리기
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // 가로 격자선
    for (let i = 0; i <= 5; i++) {
        const y = padding + (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + width, y);
        ctx.stroke();
        
        // Y축 레이블
        const value = maxValue - (valueRange / 5) * i;
        ctx.fillStyle = '#6b7280';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(value.toFixed(2), padding - 10, y + 4);
    }
    
    // 임계값 선 그리기 (3단계 평가 기준)
    if (thresholds) {
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        // 위험 기준선 (상한)
        if (thresholds.upper) {
            const y = padding + height - ((thresholds.upper - minValue) / valueRange) * height;
            ctx.strokeStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + width, y);
            ctx.stroke();
            
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`위험: ${thresholds.upper}`, padding + width + 5, y + 4);
        }
        
        // 경고 기준선
        if (thresholds.warning) {
            const y = padding + height - ((thresholds.warning - minValue) / valueRange) * height;
            ctx.strokeStyle = '#f97316';
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + width, y);
            ctx.stroke();
            
            ctx.fillStyle = '#f97316';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`경고: ${thresholds.warning}`, padding + width + 5, y + 4);
        }
        
        // 주의 기준선
        if (thresholds.caution) {
            const y = padding + height - ((thresholds.caution - minValue) / valueRange) * height;
            ctx.strokeStyle = '#f59e0b';
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + width, y);
            ctx.stroke();
            
            ctx.fillStyle = '#f59e0b';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`주의: ${thresholds.caution}`, padding + width + 5, y + 4);
        }
        
        // 하한선 (음수인 경우)
        if (thresholds.lower) {
            const y = padding + height - ((thresholds.lower - minValue) / valueRange) * height;
            ctx.strokeStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + width, y);
            ctx.stroke();
            
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`하한: ${thresholds.lower}`, padding + width + 5, y + 4);
        }
        
        ctx.setLineDash([]);
    }
    
    // 데이터 선 그리기
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const xStep = width / (values.length - 1);
    
    values.forEach((value, index) => {
        const x = padding + xStep * index;
        const y = padding + height - ((value - minValue) / valueRange) * height;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    // 데이터 포인트 그리기
    ctx.fillStyle = '#2563eb';
    values.forEach((value, index) => {
        const x = padding + xStep * index;
        const y = padding + height - ((value - minValue) / valueRange) * height;
        
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // X축 레이블
        ctx.fillStyle = '#6b7280';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labels[index], x, padding + height + 20);
    });
    
    // 제목
    if (title) {
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, canvas.width / 2, 30);
    }
    
    // Y축 레이블
    if (yLabel) {
        ctx.save();
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.translate(20, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();
    }
}

/**
 * 막대 그래프 그리기
 * @param {string} canvasId - Canvas 요소의 ID
 * @param {Object} data - 그래프 데이터
 */
function drawBarChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const { labels, values, title, yLabel, colors } = data;
    
    // Canvas 크기 설정
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const padding = 60;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;
    
    // 배경
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 최대값 계산
    const maxValue = Math.max(...values) * 1.2;
    
    // 격자선 그리기
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 5; i++) {
        const y = padding + (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + width, y);
        ctx.stroke();
        
        // Y축 레이블
        const value = maxValue - (maxValue / 5) * i;
        ctx.fillStyle = '#6b7280';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(value.toFixed(1), padding - 10, y + 4);
    }
    
    // 임계값 선 그리기 (막대그래프용)
    if (data.thresholds) {
        const thresholds = data.thresholds;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        // 각 항목별 기준선 (배열로 제공된 경우)
        if (thresholds.values && Array.isArray(thresholds.values)) {
            const barWidth = width / values.length * 0.7;
            const barGap = width / values.length * 0.3;
            const color = thresholds.color || '#f59e0b';
            const label = thresholds.label || '기준';
            
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.font = 'bold 10px sans-serif';
            
            thresholds.values.forEach((thresholdValue, index) => {
                if (thresholdValue > 0) {
                    const x = padding + (width / values.length) * index + barGap / 2;
                    const y = padding + height - (thresholdValue / maxValue) * height;
                    
                    // 해당 막대 위치에만 기준선 그리기
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + barWidth, y);
                    ctx.stroke();
                    
                    // 값 표시 (막대 오른쪽)
                    ctx.textAlign = 'left';
                    ctx.fillText(`±${thresholdValue.toFixed(1)}`, x + barWidth + 3, y + 4);
                }
            });
            
            // 범례 표시 (우측 상단)
            ctx.textAlign = 'right';
            ctx.fillText(`━━ ${label}`, padding + width - 10, padding + 15);
            
        } else {
            // 기존 방식: 전체 기준선 (단일 값)
            
            // 위험 기준선
            if (thresholds.upper) {
                const y = padding + height - (thresholds.upper / maxValue) * height;
                ctx.strokeStyle = '#ef4444';
                ctx.beginPath();
                ctx.moveTo(padding, y);
                ctx.lineTo(padding + width, y);
                ctx.stroke();
                
                ctx.fillStyle = '#ef4444';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`위험: ${thresholds.upper}`, padding + width + 5, y + 4);
            }
            
            // 경고 기준선
            if (thresholds.warning) {
                const y = padding + height - (thresholds.warning / maxValue) * height;
                ctx.strokeStyle = '#f97316';
                ctx.beginPath();
                ctx.moveTo(padding, y);
                ctx.lineTo(padding + width, y);
                ctx.stroke();
                
                ctx.fillStyle = '#f97316';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`경고: ${thresholds.warning}`, padding + width + 5, y + 4);
            }
            
            // 주의 기준선
            if (thresholds.caution) {
                const y = padding + height - (thresholds.caution / maxValue) * height;
                ctx.strokeStyle = '#f59e0b';
                ctx.beginPath();
                ctx.moveTo(padding, y);
                ctx.lineTo(padding + width, y);
                ctx.stroke();
                
                ctx.fillStyle = '#f59e0b';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`주의: ${thresholds.caution}`, padding + width + 5, y + 4);
            }
        }
        
        ctx.setLineDash([]);
    }
    
    // 막대 그리기
    const barWidth = width / values.length * 0.7;
    const barGap = width / values.length * 0.3;
    
    values.forEach((value, index) => {
        const x = padding + (width / values.length) * index + barGap / 2;
        const barHeight = (value / maxValue) * height;
        const y = padding + height - barHeight;
        
        // 막대
        ctx.fillStyle = colors && colors[index] ? colors[index] : '#3b82f6';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // 값 표시
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(value.toFixed(2), x + barWidth / 2, y - 5);
        
        // X축 레이블
        ctx.fillStyle = '#6b7280';
        ctx.font = '11px sans-serif';
        ctx.fillText(labels[index], x + barWidth / 2, padding + height + 20);
    });
    
    // 제목
    if (title) {
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, canvas.width / 2, 30);
    }
    
    // Y축 레이블
    if (yLabel) {
        ctx.save();
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.translate(20, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();
    }
}

// ==========================================
// 유틸리티 함수
// ==========================================

/**
 * 현재 날짜를 YYYY-MM-DD 형식으로 반환
 */
function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 날짜 입력 필드에 현재 날짜 설정
 */
function setCurrentDate(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.value = getCurrentDate();
    }
}

/**
 * 폼 유효성 검사
 * @param {string} formId - 폼 ID
 * @returns {boolean} 유효성 검사 통과 여부
 */
function validateForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            isValid = false;
            field.style.borderColor = '#ef4444';
            
            // 에러 메시지 표시
            let errorMsg = field.nextElementSibling;
            if (!errorMsg || !errorMsg.classList.contains('error-message')) {
                errorMsg = document.createElement('span');
                errorMsg.className = 'error-message';
                errorMsg.style.color = '#ef4444';
                errorMsg.style.fontSize = '0.875rem';
                errorMsg.textContent = '이 필드는 필수입니다.';
                field.parentNode.insertBefore(errorMsg, field.nextSibling);
            }
        } else {
            field.style.borderColor = '';
            const errorMsg = field.nextElementSibling;
            if (errorMsg && errorMsg.classList.contains('error-message')) {
                errorMsg.remove();
            }
        }
    });
    
    if (!isValid) {
        alert('모든 필수 항목을 입력해주세요.');
    }
    
    return isValid;
}

/**
 * 데이터 내보내기 (JSON)
 */
function exportData() {
    const allData = {};
    Object.keys(STORAGE_KEYS).forEach(key => {
        const data = getFromStorage(STORAGE_KEYS[key]);
        if (data) {
            allData[key] = data;
        }
    });
    
    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `품질관리데이터_${getCurrentDate()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * 데이터 가져오기 (JSON)
 */
function importData(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            Object.keys(data).forEach(key => {
                saveToStorage(key, data[key]);
            });
            alert('데이터를 성공적으로 가져왔습니다.');
            location.reload();
        } catch (error) {
            alert('데이터 가져오기 실패: 올바른 형식의 파일이 아닙니다.');
            console.error(error);
        }
    };
    reader.readAsText(file);
}

// ==========================================
// 페이지 로드 시 초기화
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    // 현재 페이지 네비게이션 활성화
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.page-nav a');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
    
    // 모든 이미지 미리보기 로드
    document.querySelectorAll('.photo-upload img[id]').forEach(img => {
        loadSavedImage(img.id);
    });
    
    console.log('품질관리 시스템이 초기화되었습니다.');
});
