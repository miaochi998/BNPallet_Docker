import React, { useState } from 'react';
import { Modal, Form, Input, Button, Upload, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { createBrand, updateCacheVersion } from '../../api/brand';
import { getApiBaseUrl } from '../../config/urls';
import axios from 'axios';
import styles from './BrandModal.module.css';

/**
 * 添加品牌弹窗组件
 */
const AddBrandModal = ({ visible, onCancel, onSuccess }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  const resetForm = () => {
    form.resetFields();
    setLogoFile(null);
    setLogoPreview('');
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 使用两步骤: 
      // 1. 先创建品牌
      // 2. 如果有logo，再上传logo

      // 第一步：创建品牌
      const createResponse = await createBrand({
        name: values.name,
        status: 'ACTIVE'
      });
      
      if (!createResponse || !createResponse.success) {
        setLoading(false);
        message.error(createResponse?.message || '品牌创建失败');
        return;
      }
      
      const brandId = createResponse.data.id;
      console.log('[ADD BRAND] 品牌创建成功，ID:', brandId);
      
      // 第二步：如果有logo文件，上传logo
      if (logoFile) {
        try {
          console.log('[ADD BRAND] 开始上传logo文件');
          const formData = new FormData();
          formData.append('file', logoFile);
          formData.append('entity_type', 'BRAND');
          formData.append('entity_id', brandId);
          formData.append('replace_existing', 'true');
          
          // 获取当前的token
          const token = localStorage.getItem('auth_token');
          
          // 获取API基础URL
          const apiBaseUrl = getApiBaseUrl();
          
          // 发送上传请求
          const uploadResponse = await axios.post(
            `${apiBaseUrl}/api/pallet/attachments/image`,
            formData,
            {
              headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': `Bearer ${token}`
              }
            }
          );
          
          console.log('[ADD BRAND] Logo上传响应:', uploadResponse);
          
          if (uploadResponse.data && uploadResponse.data.success) {
            console.log('[ADD BRAND] Logo上传成功:', uploadResponse.data.data.file_path);
            // 更新缓存版本号，强制刷新品牌列表
            const newCacheVersion = updateCacheVersion();
            
            setLoading(false);
            message.success('品牌创建成功');
            resetForm();
            onSuccess({
              brandId,
              logoUpdated: true,
              cacheVersion: newCacheVersion,
              timestamp: Date.now()
            });
            return; // 提前返回
          } else {
            console.error('[ADD BRAND] Logo上传失败:', uploadResponse.data);
            message.warning('品牌创建成功，但Logo上传失败');
          }
        } catch (uploadError) {
          console.error('[ADD BRAND] Logo上传错误:', uploadError);
          message.warning('品牌创建成功，但Logo上传失败');
        }
      }
      
      // 如果没有logo或者logo上传失败，只调用普通成功回调
      setLoading(false);
      message.success('品牌创建成功');
      resetForm();
      onSuccess();
    } catch (error) {
      setLoading(false);
      console.error('[ADD BRAND] 表单提交出错:', error);
      message.error('表单验证失败或提交出错');
    }
  };

  const beforeUpload = (file) => {
    const isImage = /\.(jpg|jpeg|png|gif)$/i.test(file.name);
    if (!isImage) {
      message.error('只能上传JPG/PNG/JPEG/GIF格式的图片!');
      return false;
    }
    
    const isLt20M = file.size / 1024 / 1024 < 20;
    if (!isLt20M) {
      message.error('图片必须小于20MB!');
      return false;
    }
    
    // 设置文件和预览
    setLogoFile(file);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setLogoPreview(reader.result);
      console.log('[ADD BRAND] 设置logo预览');
    };
    
    // 阻止自动上传
    return false;
  };

  const uploadButton = (
    <div>
      <PlusOutlined />
      <div style={{ marginTop: 8 }}>上传</div>
    </div>
  );

  return (
    <Modal
      title="添加品牌"
      open={visible}
      onCancel={() => {
        resetForm();
        onCancel();
      }}
      footer={[
        <Button 
          key="cancel" 
          onClick={() => {
            resetForm();
            onCancel();
          }}
        >
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
        >
          保存
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="品牌名称"
          rules={[{ required: true, message: '请输入品牌名称' }]}
        >
          <Input placeholder="请输入品牌名称" />
        </Form.Item>

        <Form.Item label="品牌Logo" className={styles.logoUpload}>
          <Upload
            name="logo"
            listType="picture-card"
            className="avatar-uploader"
            showUploadList={false}
            beforeUpload={beforeUpload}
          >
            {logoPreview ? (
              <img 
                src={logoPreview} 
                alt="logo" 
                style={{ width: '100%' }} 
                onError={() => {
                  console.error('[ADD BRAND] logo预览图片加载失败');
                  setLogoPreview('');
                }}
              />
            ) : (
              uploadButton
            )}
          </Upload>
          <div className={styles.uploadHint}>
            支持JPG、PNG、JPEG、GIF格式，小于20MB
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};

// 包装组件，提供App上下文
const AddBrandModalWithApp = (props) => (
  <App>
    <AddBrandModal {...props} />
  </App>
);

export default AddBrandModalWithApp; 