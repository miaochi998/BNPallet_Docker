import React, { useState, useMemo } from 'react';
import { Input, Empty, Spin, Typography } from 'antd';
import SalesPersonCard from './SalesPersonCard';
import styles from './styles.module.css';

const { Title } = Typography;

/**
 * 销售员列表组件
 * @param {Object} props
 * @param {Array} props.salesList - 销售员列表数据
 * @param {boolean} props.loading - 加载状态
 * @param {Function} props.onSelectSalesperson - 选择销售员回调
 * @param {Object} props.currentSalesperson - 当前选中的销售员
 * @returns {JSX.Element}
 */
const SalesPersonList = ({ 
  salesList = [], 
  loading = false, 
  onSelectSalesperson, 
  currentSalesperson = null
}) => {
  // 搜索状态
  const [searchValue, setSearchValue] = useState('');
  
  // 处理搜索
  const handleSearch = (value) => {
    setSearchValue(value);
  };
  
  // 筛选销售员
  const filteredSalesList = useMemo(() => {
    if (!searchValue || !salesList.length) return salesList;
    
    const lowerCaseValue = searchValue.toLowerCase();
    return salesList.filter(person => 
      (person.name && person.name.toLowerCase().includes(lowerCaseValue)) || 
      (person.username && person.username.toLowerCase().includes(lowerCaseValue))
    );
  }, [salesList, searchValue]);
  
  return (
    <div className={styles.salesPersonList}>
      <div className={styles.listHeader}>
        <Title level={4}>公司销售员</Title>
        <Input.Search
          placeholder="搜索销售员"
          onSearch={handleSearch}
          onChange={(e) => handleSearch(e.target.value)}
          style={{ width: 200 }}
          allowClear
        />
      </div>
      
      {loading ? (
        <div className={styles.loading}>
          <Spin />
        </div>
      ) : (
        <div className={styles.cardContainer}>
          {filteredSalesList.length > 0 ? (
            filteredSalesList.map(person => (
              <SalesPersonCard
                key={person.id}
                salesperson={person}
                onSelect={onSelectSalesperson}
                selected={currentSalesperson?.id === person.id}
              />
            ))
          ) : (
            <Empty description="暂无销售员信息" />
          )}
        </div>
      )}
    </div>
  );
};

export default SalesPersonList; 