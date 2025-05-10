import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Button, Space, Typography, Image, 
  Modal, Input, message, Empty, Row, Col, Spin, Alert,
  Tooltip, Tag
} from 'antd';
import { 
  ShareAltOutlined, QrcodeOutlined, CopyOutlined, 
  LinkOutlined, EyeOutlined, ReloadOutlined
} from '@ant-design/icons';
import { getShareHistory, generateQrCode } from '@/api/pallet';
import { formatDateTime } from '@/utils/formatDateTime';
import styles from './ShareHistory.module.css';

const { Title, Text } = Typography;

/**
 * 货盘分享历史记录页面
 */
const ShareHistory = () => {
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  
  // 模态框状态
  const [qrcodeVisible, setQrcodeVisible] = useState(false);
  const [currentShare, setCurrentShare] = useState(null);
  const [qrcodeLoading, setQrcodeLoading] = useState(false);
  const [qrcodeUrl, setQrcodeUrl] = useState(null);
  
  // 获取分享历史记录
  const fetchShareHistory = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await getShareHistory({
        page,
        pageSize
      });
      
      const { items, meta } = response.data;
      
      setData(items || []);
      setPagination({
        current: meta.current_page,
        pageSize: meta.page_size,
        total: meta.total_count
      });
    } catch (error) {
      console.error('获取分享历史记录失败:', error);
      message.error('获取分享历史记录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 处理刷新按钮点击
  const handleRefresh = () => {
    // 重置分页到第一页
    setPagination(prev => ({
      ...prev,
      current: 1
    }));
    // 获取最新数据
    fetchShareHistory(1, pagination.pageSize);
  };
  
  // 初始加载
  useEffect(() => {
    fetchShareHistory();
  }, []);
  
  // 处理表格分页变化
  const handleTableChange = (pagination) => {
    fetchShareHistory(pagination.current, pagination.pageSize);
  };
  
  // 处理查看二维码
  const handleViewQrcode = async (record) => {
    setCurrentShare(record);
    setQrcodeVisible(true);
    setQrcodeLoading(true);
    
    try {
      const response = await generateQrCode(record.token);
      setQrcodeUrl(response.data.qrcode_url);
    } catch (error) {
      console.error('生成二维码失败:', error);
      message.error('生成二维码失败，请稍后重试');
    } finally {
      setQrcodeLoading(false);
    }
  };
  
  // 处理复制链接
  const handleCopyLink = (shareUrl) => {
    navigator.clipboard.writeText(shareUrl)
      .then(() => message.success('链接已复制到剪贴板'))
      .catch(() => message.error('复制失败，请手动复制'));
  };
  
  // 表格列定义
  const columns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_, __, index) => (pagination.current - 1) * pagination.pageSize + index + 1
    },
    {
      title: '分享类型',
      dataIndex: 'share_type',
      key: 'share_type',
      width: 130,
      render: (type) => (
        <Tag color="blue" style={{ padding: '2px 8px' }}>
          {type === 'FULL' ? '完整货盘' : type}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (date) => formatDateTime(date)
    },
    {
      title: '最后访问时间',
      dataIndex: 'last_accessed',
      key: 'last_accessed',
      width: 170,
      render: (date) => date ? formatDateTime(date) : '暂未访问'
    },
    {
      title: '访问次数',
      dataIndex: 'access_count',
      key: 'access_count',
      width: 80
    },
    {
      title: '分享链接',
      dataIndex: 'share_url',
      key: 'share_url',
      render: (url) => (
        <div className={styles.linkCell}>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Space align="start">
              <LinkOutlined style={{ flexShrink: 0, marginTop: '4px' }} />
              <span style={{ wordBreak: 'break-all', whiteSpace: 'normal' }}>{url}</span>
            </Space>
          </a>
        </div>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button 
            icon={<QrcodeOutlined />} 
            onClick={() => handleViewQrcode(record)}
            type="primary"
            size="small"
          >
            查看二维码
          </Button>
          <Button 
            icon={<CopyOutlined />} 
            onClick={() => handleCopyLink(record.share_url)}
            size="small"
          >
            复制链接
          </Button>
          <Button
            icon={<EyeOutlined />}
            href={record.share_url}
            target="_blank"
            size="small"
          >
            查看
          </Button>
        </Space>
      )
    }
  ];
  
  return (
    <div className={styles.shareHistoryContainer}>
      <Card 
        title={
          <Space>
            <ShareAltOutlined />
            <span>货盘分享历史记录</span>
          </Space>
        }
        extra={
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
            loading={loading}
          >
            刷新
          </Button>
        }
        className={styles.shareHistoryCard}
      >
        {data.length === 0 && !loading ? (
          <Empty description="暂无分享记录" />
        ) : (
          <Table
            columns={columns}
            dataSource={data}
            rowKey="token"
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
            onChange={handleTableChange}
            loading={loading}
            className={styles.shareHistoryTable}
            tableLayout="fixed"
            bordered={false}
            size="middle"
          />
        )}
      </Card>
      
      <Modal
        title="货盘分享二维码"
        open={qrcodeVisible}
        onCancel={() => setQrcodeVisible(false)}
        footer={[
          <Button 
            key="copy" 
            icon={<CopyOutlined />}
            onClick={() => currentShare && handleCopyLink(currentShare.share_url)}
          >
            复制链接
          </Button>,
          <Button 
            key="view" 
            type="primary" 
            icon={<EyeOutlined />}
            href={currentShare?.share_url}
            target="_blank"
          >
            查看货盘
          </Button>,
          <Button 
            key="close" 
            onClick={() => setQrcodeVisible(false)}
          >
            关闭
          </Button>
        ]}
        width={500}
        centered
      >
        {qrcodeLoading ? (
          <div className={styles.qrcodeLoading}>
            <Spin tip="二维码生成中..." />
          </div>
        ) : qrcodeUrl ? (
          <div className={styles.qrcodeContent}>
            <div className={styles.qrcodeImageContainer}>
              <Image
                src={qrcodeUrl}
                alt="分享二维码"
                className={styles.qrcodeImage}
              />
            </div>
            
            <div className={styles.qrcodeInfo}>
              <Text type="secondary">创建时间: {currentShare && formatDateTime(currentShare.created_at)}</Text>
              <Text type="secondary">访问次数: {currentShare?.access_count || 0}</Text>
            </div>
            
            <Input.Group compact className={styles.shareLinkInput}>
              <Input
                value={currentShare?.share_url}
                readOnly
                style={{ width: 'calc(100% - 80px)' }}
              />
              <Button 
                type="primary"
                icon={<CopyOutlined />}
                onClick={() => currentShare && handleCopyLink(currentShare.share_url)}
                style={{ width: 80 }}
              >
                复制
              </Button>
            </Input.Group>
            
            <Alert
              type="info"
              showIcon
              message="该链接永久有效，可随时分享给客户。客户无需登录即可查看您的最新货盘信息。"
              className={styles.shareAlert}
            />
          </div>
        ) : (
          <Empty description="二维码获取失败" />
        )}
      </Modal>
    </div>
  );
};

export default ShareHistory; 