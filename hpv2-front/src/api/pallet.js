import request from '@/utils/request';
import { getImageUrl } from '@/config/urls';

/**
 * 生成分享链接
 * @param {object} data - 分享参数
 * @returns {Promise}
 */
export function createShareLink(data = { share_type: 'FULL' }) {
  return request({
    url: '/api/pallet/share',
    method: 'POST',
    data
  });
}

/**
 * 生成二维码
 * @param {string} token - 分享链接token
 * @param {number} size - 二维码尺寸
 * @returns {Promise}
 */
export function generateQrCode(token, size = 500) {
  return request({
    url: '/api/pallet/share/qrcode',
    method: 'POST',
    data: { token, size }
  });
}

/**
 * 获取分享历史记录
 * @param {object} params - 分页参数
 * @returns {Promise}
 */
export function getShareHistory(params = {}) {
  return request({
    url: '/api/pallet/share/history',
    method: 'GET',
    params: {
      page: params.page || 1,
      page_size: params.pageSize || 10
    }
  });
}

/**
 * 获取分享链接详情和产品列表
 * @param {string} token - 分享链接token
 * @param {object} params - 筛选和分页参数
 * @returns {Promise}
 */
export function getPalletShareData(token, params = {}) {
  return request({
    url: `/api/pallet/share/${token}`,
    method: 'GET',
    params: {
      page: params.page || 1,
      page_size: params.pageSize || 10,
      search: params.search || '',
      brand_id: params.brandId || undefined,
      sort_field: params.sortField || 'created_at',
      sort_order: params.sortOrder || 'desc'
    }
  });
}

/**
 * 获取图片URL
 * @param {string} path - 图片路径
 * @returns {string}
 */
export function getProductImageUrl(path) {
  if (!path) return null;
  return getImageUrl(path);
}

/**
 * 下载附件
 * @param {string} path - 附件路径
 * @returns {string}
 */
export function getAttachmentUrl(path) {
  if (!path) return null;
  return getImageUrl(path);
} 