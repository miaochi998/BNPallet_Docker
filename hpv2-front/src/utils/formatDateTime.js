/**
 * 格式化日期时间字符串
 * @param {string} dateTimeString - ISO格式的日期时间字符串
 * @param {boolean} includeTime - 是否包含时间部分，默认为true
 * @returns {string} - 格式化后的日期时间字符串
 */
export function formatDateTime(dateTimeString, includeTime = true) {
  if (!dateTimeString) {
    return '-';
  }
  
  try {
    const date = new Date(dateTimeString);
    
    if (isNaN(date.getTime())) {
      return dateTimeString; // 如果解析失败，返回原字符串
    }
    
    // 补零函数
    const padZero = (num) => String(num).padStart(2, '0');
    
    // 格式化年月日
    const year = date.getFullYear();
    const month = padZero(date.getMonth() + 1);
    const day = padZero(date.getDate());
    
    // 基本日期格式
    let formattedDate = `${year}-${month}-${day}`;
    
    // 如果需要包含时间
    if (includeTime) {
      const hours = padZero(date.getHours());
      const minutes = padZero(date.getMinutes());
      const seconds = padZero(date.getSeconds());
      
      formattedDate += ` ${hours}:${minutes}:${seconds}`;
    }
    
    return formattedDate;
  } catch (error) {
    console.error('日期格式化错误:', error);
    return dateTimeString; // 发生错误时返回原字符串
  }
} 