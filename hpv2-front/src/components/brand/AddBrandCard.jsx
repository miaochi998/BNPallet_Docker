import React from 'react';
import { Card } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';
import styles from './AddBrandCard.module.css';

/**
 * 添加品牌卡片组件 - 点击触发添加品牌操作
 */
const AddBrandCard = ({ onClick }) => {
  return (
    <Card 
      className={styles.addCard} 
      hoverable 
      onClick={onClick}
    >
      <div className={styles.content}>
        <PlusOutlined className={styles.plusIcon} />
        <span className={styles.text}>添加品牌</span>
      </div>
    </Card>
  );
};

AddBrandCard.propTypes = {
  onClick: PropTypes.func.isRequired
};

export default AddBrandCard; 