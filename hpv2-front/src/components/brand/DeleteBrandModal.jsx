import React from 'react';
import { Modal, Typography } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';

const { Text } = Typography;

/**
 * 删除品牌确认弹窗组件
 */
const DeleteBrandModal = ({ visible, loading, brand, onCancel, onConfirm }) => {
  return (
    <Modal
      title="删除品牌"
      open={visible && !!brand}
      onOk={() => onConfirm(brand?.id)}
      onCancel={onCancel}
      confirmLoading={loading}
      okText="确认删除"
      cancelText="取消"
      okButtonProps={{ danger: true }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 22, marginTop: 2 }} />
        <div>
          <Text>确定要删除品牌 "{brand?.name}" 吗？</Text>
          <br />
          <Text type="secondary">
            删除后无法恢复，相关产品将失去品牌关联。
          </Text>
        </div>
      </div>
    </Modal>
  );
};

DeleteBrandModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  loading: PropTypes.bool,
  brand: PropTypes.object,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired
};

DeleteBrandModal.defaultProps = {
  loading: false,
  brand: null
};

export default DeleteBrandModal; 