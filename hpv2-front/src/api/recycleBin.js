import request from '@/utils/request';

/**
 * 获取回收站产品列表
 * @param {Object} params - 查询参数
 * @returns {Promise}
 */
export function getRecycleBinItems(params) {
  return request({
    url: '/api/pallet/recycle',
    method: 'get',
    params
  });
}

/**
 * 还原产品
 * @param {number} id - 回收站记录ID
 * @returns {Promise}
 */
export function restoreProduct(id) {
  return request({
    url: `/api/pallet/recycle/${id}/restore`,
    method: 'post',
    data: {
      confirm: true
    }
  });
}

/**
 * 永久删除产品
 * @param {number} id - 回收站记录ID
 * @returns {Promise}
 */
export function deleteProduct(id) {
  return request({
    url: `/api/pallet/recycle/${id}`,
    method: 'delete',
    data: {
      confirm: true
    }
  });
}

/**
 * 批量还原产品
 * @param {number[]} ids - 回收站记录ID数组
 * @returns {Promise}
 */
export function batchRestoreProducts(ids) {
  return request({
    url: '/api/pallet/recycle/batch-restore',
    method: 'post',
    data: {
      ids
    }
  });
}

/**
 * 批量永久删除产品
 * @param {number[]} ids - 回收站记录ID数组
 * @returns {Promise}
 */
export function batchDeleteProducts(ids) {
  return request({
    url: '/api/pallet/recycle/batch-delete',
    method: 'post',
    data: {
      ids,
      confirm: true
    }
  });
} 