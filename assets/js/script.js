// ==========================================
// 품질관리 대시보드 시스템 - 공통 JavaScript
// ==========================================

// LocalStorage 키 상수
const STORAGE_KEYS = {
    PROJECT_INFO: 'qms_project_info',
    SURVEY_DATA: 'qms_survey_data',
    ACCELERATION_DATA: 'qms_acceleration_data',
    TILT_DATA: 'qms_tilt_data',
    STRAIN_DATA: 'qms_strain_data',
    FABRICATION_ERROR: 'qms_fabrication_error',
    PHOTOS: 'qms_photos'
};

// ==========================================
// 이미지 미리보기 기능
// ==========================================

/**
 * 이미지 미리보기 표시
 * @param {HTMLInputElement} input - 파일 입력 요소
 * @param {string} previewId - 미리보기 이미지 요소의 ID
 */
function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    const container = input.closest('.photo-upload');
    const placeholder = container.querySelector('.placeholder');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            if (placeholder) {
                placeholder.style.display = 'none';
            }
            container.classList.add('has-image');
            
            // 이미지를 LocalStorage에 저장
            saveImageToStorage(previewId, e.target.result);
        };
        
        reader.readAsDataURL(input.files[0]);
    }
}

/**
 * 이미지를 LocalStorage에 저장
 * @param {string} key - 저장 키
 * @param {string} imageData - Base64 인코딩된 이미지 데이터
 */
function saveImageToStorage(key, imageData) {
    try {
        const photos = getFromStorage(STORAGE_KEYS.PHOTOS) || {};
        photos[key] = imageData;
        saveToStorage(STORAGE_KEYS.PHOTOS, photos);
    } catch (e) {
        console.error('이미지 저장 실패:', e);
        alert('이미지가 너무 큽니다. 더 작은 이미지를 선택해주세요.');
    }
}

/**
 * 저장된 이미지 로드
 * @param {string} key - 저장 키
 * @param {string} previewId - 미리보기 이미지 요소의 ID
 */
function loadSavedImage(previewId) {
    const photos = getFromStorage(STORAGE_KEYS.PHOTOS);
    if (photos && photos[previewId]) {
        const preview = document.getElementById(previewId);
        const container = preview.closest('.photo-upload');
        const placeholder = container.querySelector('.placeholder');
        
        preview.src = photos[previewId];
        preview.style.display = 'block';
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        container.classList.add('has-image');
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
        localStorage.setItem(key, JSON.stringify(data));
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
        const data = localStorage.getItem(key);
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
    localStorage.removeItem(key);
}

/**
 * 모든 데이터 초기화
 */
function clearAllData() {
    if (confirm('모든 저장된 데이터를 삭제하시겠습니까?')) {
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
    
    // 폼 입력 변경 시 자동 저장
    form.addEventListener('change', function() {
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
    
    // 임계값 선 그리기
    if (thresholds) {
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        if (thresholds.upper) {
            const y = padding + height - ((thresholds.upper - minValue) / valueRange) * height;
            ctx.strokeStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + width, y);
            ctx.stroke();
            
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`상한: ${thresholds.upper}`, padding + width + 10, y + 4);
        }
        
        if (thresholds.lower) {
            const y = padding + height - ((thresholds.lower - minValue) / valueRange) * height;
            ctx.strokeStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + width, y);
            ctx.stroke();
            
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`하한: ${thresholds.lower}`, padding + width + 10, y + 4);
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
