import React, { useState, useEffect } from 'react';
import { Table, Pagination, Space, Spin, Empty, ConfigProvider, Select } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './DataTable.css';

// 全局样式覆盖
const globalOverrideStyle = `
  .ant-select-dropdown {
    position: fixed !important;
    z-index: 1500 !important;
  }
`;

/**
 * 通用数据表格组件
 * 
 * @param {Object} props
 * @param {Array} props.columns - 列配置
 * @param {Array} props.dataSource - 数据源
 * @param {Object} props.pagination - 分页配置
 * @param {number} props.pagination.current - 当前页码
 * @param {number} props.pagination.pageSize - 每页条数
 * @param {number} props.pagination.total - 总条数
 * @param {Function} props.onChange - 分页、排序、筛选变化时的回调
 * @param {boolean} props.loading - 加载状态
 * @param {Object} props.rowSelection - 行选择配置
 * @param {boolean} props.showPagination - 是否显示分页器
 * @param {boolean} props.showTable - 是否显示表格，默认为true
 * @param {Object} props.tableProps - 传递给antd Table的其他属性
 */
const DataTable = ({
  columns = [],
  dataSource = [],
  pagination = {},
  onChange,
  loading = false,
  rowSelection,
  showPagination = true,
  showTable = true,
  tableProps = {},
}) => {
  // 默认分页配置
  const defaultPagination = {
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total) => `共 ${total} 条记录`,
  };

  // 合并分页配置
  const paginationConfig = {
    ...defaultPagination,
    ...pagination,
  };

  // 表格变化处理函数
  const handleTableChange = (pagination, filters, sorter) => {
    if (onChange) {
      onChange(pagination, filters, sorter);
    }
  };

  // 当使用外部分页时，Table的分页设置为false
  const tableConfig = {
    ...tableProps,
    pagination: false, // 禁用表格内置分页，使用外部分页组件
  };

  return (
    <ConfigProvider locale={zhCN}>
      <style>{globalOverrideStyle}</style>
      <div className="data-table-container">
        {/* 主表格，根据showTable显示或隐藏 */}
        {showTable && (
          <Table
            className="data-table"
            rowKey={(record) => record.id || record.key}
            columns={columns}
            dataSource={dataSource}
            loading={loading}
            rowSelection={rowSelection}
            onChange={handleTableChange}
            locale={{
              emptyText: <Empty description="暂无数据" />,
            }}
            {...tableConfig}
          />
        )}

        {/* 外部分页器，始终显示，但按需隐藏 */}
        {showPagination && (
          <div className="pagination-container">
            <Pagination
              {...paginationConfig}
              showLessItems={false} /* 显示更多页码 */
              pageSizeOptions={['10', '20', '50', '100']} /* 设置符合后端API的页大小选项 */
              selectComponentClass={(props) => (
                <ConfigProvider
                  getPopupContainer={(triggerNode) => {
                    return triggerNode.parentNode || document.body;
                  }}
                >
                  <Select {...props} />
                </ConfigProvider>
              )}
              onChange={(page, pageSize) => {
                handleTableChange(
                  { ...paginationConfig, current: page, pageSize },
                  {},
                  {}
                );
              }}
              onShowSizeChange={null} // 移除默认的onShowSizeChange处理函数，使用onChange统一处理
            />
          </div>
        )}
      </div>
    </ConfigProvider>
  );
};

export default DataTable; 