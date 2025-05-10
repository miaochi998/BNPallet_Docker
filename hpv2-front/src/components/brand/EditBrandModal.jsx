import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Upload, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getBrandDetail, updateBrand, uploadLogo, updateCacheVersion } from '../../api/brand';
import { getImageUrl } from '../../config/urls';
import styles from './BrandModal.module.css';

/**
 * 编辑品牌弹窗组件
 */
const EditBrandModal = ({ visible, brandId, onCancel, onSuccess }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [brandStatus, setBrandStatus] = useState('');

  // 加载品牌数据
  const loadBrandData = async () => {
    if (brandId) {
      try {
        setLoading(true);
        const response = await getBrandDetail(brandId);
        if (response && response.success) {
          const brand = response.data;
          form.setFieldsValue({
            name: brand.name,
          });
          
          // 记录品牌当前状态
          setBrandStatus(brand.status);
          
          // 设置logo预览
          if (brand.logo_url) {
            // 使用集中URL配置生成图片URL
            const timestamp = Date.now();
            const imageUrl = getImageUrl(brand.logo_url, `?_t=${timestamp}`);
            setLogoPreview(imageUrl);
            console.log('[EDIT BRAND] 设置Logo预览URL:', imageUrl);
          }
          
          setInitialLoaded(true);
        } else {
          message.error(response?.message || '获取品牌信息失败');
        }
      } catch (error) {
        console.error('[EDIT BRAND] 加载品牌数据出错:', error);
        message.error('加载品牌数据失败');
      } finally {
        setLoading(false);
      }
    }
  };

  // 当brandId变化或弹窗可见时加载品牌数据
  useEffect(() => {
    if (visible && brandId) {
      loadBrandData();
    }
    // 当弹窗关闭时重置状态
    if (!visible) {
      resetForm();
    }
  }, [visible, brandId]);

  // 重置表单
  const resetForm = () => {
    form.resetFields();
    setLogoFile(null);
    setLogoPreview('');
    setInitialLoaded(false);
  };

  // 处理表单提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      // 如果有新的logo文件，先上传logo
      let newLogoUrl = null;
      if (logoFile) {
        try {
          const uploadResponse = await uploadLogo(logoFile, brandId);
          
          if (uploadResponse && uploadResponse.success) {
            const logoData = uploadResponse.data;
            
            // 获取新的logo_url
            if (logoData && logoData.logo_url) {
              newLogoUrl = logoData.logo_url;
            }
          } else {
            message.warning('Logo上传失败，将只更新品牌基本信息');
          }
        } catch (uploadError) {
          console.error('[EDIT BRAND] Logo上传错误:', uploadError);
          message.warning('Logo上传失败，将只更新品牌基本信息');
        }
      }

      // 构建更新数据
      const updateData = {
        name: values.name,
        status: brandStatus
      };
      
      // 如果有新的logo_url，添加到更新数据中
      if (newLogoUrl) {
        updateData.logo_url = newLogoUrl;
      }
      
      // 更新品牌基本信息
      const updateResponse = await updateBrand(brandId, updateData);
      
      if (!updateResponse || !updateResponse.success) {
        setLoading(false);
        message.error(updateResponse?.message || '品牌更新失败');
        return;
      }
      
      message.success('品牌更新成功');
      
      // 完全重置表单和状态
      resetForm();
      
      // 向父组件传递成功信息
      onSuccess({
        logoUpdated: !!newLogoUrl,
        brandId,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[EDIT BRAND] 表单提交出错:', error);
      message.error('表单验证失败或提交出错');
    } finally {
      setLoading(false);
    }
  };

  // 图片上传前的验证
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
    };
    
    // 阻止自动上传
    return false;
  };

  // 上传按钮UI
  const uploadButton = (
    <div>
      <PlusOutlined />
      <div style={{ marginTop: 8 }}>上传</div>
    </div>
  );

  return (
    <Modal
      title="编辑品牌"
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
          disabled={!initialLoaded}
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
                alt="品牌Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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

// 使用App上下文包装组件
const EditBrandModalWithApp = (props) => (
  <EditBrandModal {...props} />
);

export default EditBrandModalWithApp; 