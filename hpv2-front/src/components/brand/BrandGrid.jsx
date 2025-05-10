import React from 'react';
import PropTypes from 'prop-types';
import { Row, Col, Spin, Empty, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import BrandCard from './BrandCard';

/**
 * 品牌网格组件 - 展示品牌卡片网格
 */
const BrandGrid = ({ 
  brands, 
  loading, 
  onAddBrand, 
  onEditBrand, 
  onDeleteBrand, 
  onStatusChange 
}) => {
  // 如果没有品牌数据，显示空状态
  if (!loading && (!brands || brands.length === 0)) {
    return (
      <Empty 
        image={Empty.PRESENTED_IMAGE_SIMPLE} 
        description="暂无品牌数据"
        style={{ marginTop: '100px' }}
      >
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={onAddBrand}
        >
          添加品牌
        </Button>
      </Empty>
    );
  }

  return (
    <Spin spinning={loading} tip="加载中...">
      <Row gutter={[16, 16]}>
        {brands.map(brand => (
          <Col xs={24} sm={12} md={8} lg={6} xl={4} key={brand.id} style={{ flex: '0 0 20%', maxWidth: '20%' }}>
            <BrandCard
              brand={brand}
              onEdit={onEditBrand}
              onDelete={onDeleteBrand}
              onStatusChange={onStatusChange}
            />
          </Col>
        ))}
      </Row>
    </Spin>
  );
};

BrandGrid.propTypes = {
  brands: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired,
      logo_url: PropTypes.string,
      status: PropTypes.string.isRequired,
    })
  ),
  loading: PropTypes.bool.isRequired,
  onAddBrand: PropTypes.func.isRequired,
  onEditBrand: PropTypes.func.isRequired,
  onDeleteBrand: PropTypes.func.isRequired,
  onStatusChange: PropTypes.func.isRequired,
};

BrandGrid.defaultProps = {
  brands: [],
};

export default BrandGrid; 