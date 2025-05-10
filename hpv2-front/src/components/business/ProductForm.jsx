import React, { useState, useEffect, useCallback } from 'react';
import { 
  Form, Input, Select, Button, Upload, Space, Card, 
  Divider, Row, Col, message, Typography, Tooltip
} from 'antd';
import { 
  PlusOutlined, 
  MinusOutlined, 
  PlusSquareOutlined, 
  MinusSquareOutlined, 
  UploadOutlined 
} from '@ant-design/icons';
import request from '@/utils/request';
import { getImageUrl } from '@/config/urls';
import styles from './ProductForm.module.css';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * 产品表单组件 - 用于添加/编辑产品
 * 
 * @param {Object} props
 * @param {boolean} props.isEdit - 是否为编辑模式
 * @param {Object} props.initialValues - 初始值（编辑模式下使用）
 * @param {Function} props.onFinish - 表单提交成功回调
 * @param {Function} props.onCancel - 取消操作回调
 */
const ProductForm = ({ isEdit = false, initialValues = {}, onFinish, onCancel }) => {
  const [form] = Form.useForm();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [materialList, setMaterialList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState([]);
  const [imageFileName, setImageFileName] = useState('');
  const [materialFileName, setMaterialFileName] = useState('');

  // 获取品牌列表
  const fetchBrands = useCallback(async () => {
    try {
      const response = await request({
        url: '/api/pallet/brands',
        method: 'GET',
        params: {
          status: 'ACTIVE'
        }
      });
      
      if (response && response.data && response.data.list) {
        setBrands(response.data.list);
      }
    } catch (error) {
      console.error('获取品牌列表失败:', error);
      message.error('获取品牌列表失败');
    }
  }, []);

  // 初始化表单数据
  useEffect(() => {
    fetchBrands();
    
    // 编辑模式下，设置初始值
    if (isEdit && initialValues.id) {
      // 设置表单字段值
      form.setFieldsValue({
        name: initialValues.name,
        brand_id: initialValues.brand_id,
        product_code: initialValues.product_code,
        specification: initialValues.specification,
        net_content: initialValues.net_content,
        product_size: initialValues.product_size,
        shipping_method: initialValues.shipping_method,
        shipping_spec: initialValues.shipping_spec,
        shipping_size: initialValues.shipping_size,
        product_url: initialValues.product_url,
      });
      
      // 设置价格档位
      if (initialValues.price_tiers && Array.isArray(initialValues.price_tiers) && initialValues.price_tiers.length > 0) {
        const priceTiers = initialValues.price_tiers.map(tier => ({
          quantity: tier.quantity,
          price: tier.price,
          id: tier.id // 保存已有价格档位的ID
        }));
        form.setFieldsValue({ price_tiers: priceTiers });
      } else {
        // 如果没有价格档位数据，添加一个空的价格档位行
        form.setFieldsValue({ price_tiers: [{ quantity: '', price: '' }] });
      }
      
      // 设置图片和素材包
      if (initialValues.attachments && Array.isArray(initialValues.attachments)) {
        // 处理产品图片
        const productImage = initialValues.attachments.find(
          attachment => attachment.file_type === 'IMAGE'
        );
        
        if (productImage) {
          const imageUrl = getImageUrl(productImage.file_path);
          setFileList([{
            uid: productImage.id,
            name: productImage.file_name || '产品图片',
            status: 'done',
            url: imageUrl,
            response: { data: { id: productImage.id } } // 保存附件ID用于编辑时识别
          }]);
          setImageFileName(productImage.file_name || '产品图片');
        }
        
        // 处理素材包
        const material = initialValues.attachments.find(
          attachment => attachment.file_type === 'MATERIAL'
        );
        
        if (material) {
          setMaterialList([{
            uid: material.id,
            name: material.file_name || '素材包',
            status: 'done',
            response: { data: { id: material.id } } // 保存附件ID用于编辑时识别
          }]);
          setMaterialFileName(material.file_name || '素材包');
        }
      }
    } else {
      // 添加模式下，初始化一个空的价格档位
      form.setFieldsValue({
        price_tiers: [{ quantity: '', price: '' }]
      });
    }
  }, [isEdit, initialValues, form, fetchBrands]);

  // 处理表单提交
  const handleSubmit = async (values) => {
    setSubmitting(true);
    console.log('原始表单提交数据:', values);
    
    try {
      // 处理表单数据，确保所有字段符合后端要求
      const formData = {};
      
      // 处理必填字段
      formData.name = values.name;
      
      // 处理可选字段
      // 品牌ID处理
      if (values.brand_id !== undefined) {
        formData.brand_id = values.brand_id;
      } else if (isEdit) {
        // 编辑模式下，明确设置为null表示删除关联
        formData.brand_id = null;
      }
      
      // 产品货号处理
      if (values.product_code !== undefined) {
        formData.product_code = values.product_code ? values.product_code.trim() : '';
      }
      
      // 处理其他可选文本字段
      const optionalFields = [
        'specification', 'net_content', 'product_size', 
        'shipping_method', 'shipping_spec', 'shipping_size'
      ];
      
      optionalFields.forEach(field => {
        // 字段存在于表单中，包括空字符串
        if (values[field] !== undefined) {
          // 有值则保留值，没有值则设为空字符串
          formData[field] = values[field] ? values[field].trim() : '';
        }
      });
      
      // 处理product_url - 特别注意这个字段的URL格式验证
      // 1. 如果有值且不为空，验证格式后设置
      // 2. 如果为空或未定义，则设置为空字符串
      if (values.product_url && values.product_url.trim() !== '') {
        let url = values.product_url.trim();
        // 确保URL有http前缀
        if (!url.match(/^https?:\/\//)) {
          url = 'http://' + url;
        }
        
        // 验证是否是有效的URL格式
        const urlPattern = /^(https?:\/\/)(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:[0-9]+)?(\/[^\s]*)?$/;
        if (urlPattern.test(url)) {
          formData.product_url = url;
        } else {
          // URL格式不正确，设置为空字符串
          formData.product_url = '';
          // 为用户提供警告
          message.warning('产品链接格式不正确，已忽略此字段');
        }
      } else {
        // 明确设置为空字符串表示删除此字段
        formData.product_url = '';
      }
      
      // 如果有要删除的附件，添加到formData中
      if (deletedAttachmentIds.length > 0) {
        formData.deleted_attachment_ids = deletedAttachmentIds;
        console.log('要删除的附件ID列表:', deletedAttachmentIds);
      }
      
      console.log('处理后的表单数据:', formData);
      
      let productId;
      let savedProduct;
      
      // 创建或更新产品
      if (isEdit) {
        // 编辑模式：更新产品信息
        console.log(`发送编辑请求，产品ID: ${initialValues.id}`, JSON.stringify(formData));
        const response = await request({
          url: `/api/pallet/products/${initialValues.id}`,
          method: 'PUT',
          data: formData
        });
        
        console.log('编辑请求响应:', response);
        
        if (response && response.code === 200) {
          productId = initialValues.id;
          savedProduct = response.data;
          message.success('产品更新成功');
        }
      } else {
        // 添加模式：创建新产品
        console.log('发送添加产品请求', JSON.stringify(formData));
        const response = await request({
          url: '/api/pallet/products',
          method: 'POST',
          data: formData
        });
        
        console.log('添加请求响应:', response);
        
        if (response && response.code === 200) {
          productId = response.data.id;
          savedProduct = response.data;
          message.success('产品创建成功');
        }
      }
      
      // 如果有productId，处理价格档位
      if (productId) {
        // 处理价格档位
        if (values.price_tiers && values.price_tiers.length > 0) {
          // 删除空的价格档位
          const validPriceTiers = values.price_tiers.filter(
            tier => tier.quantity && tier.price
          );
          
          // 分别处理新增和更新的价格档位
          const priceTierPromises = [];
          for (const tier of validPriceTiers) {
            if (tier.id) {
              // 已有价格档位，更新
              priceTierPromises.push(
                request({
                  url: `/api/pallet/price_tiers/${tier.id}`,
                  method: 'PUT',
                  data: {
                    quantity: tier.quantity,
                    price: tier.price
                  }
                })
              );
            } else {
              // 新增价格档位
              priceTierPromises.push(
                request({
                  url: '/api/pallet/price_tiers',
                  method: 'POST',
                  data: {
                    product_id: productId,
                    quantity: tier.quantity,
                    price: tier.price
                  }
                })
              );
            }
          }
          
          // 并行处理价格档位的创建/更新
          await Promise.all(priceTierPromises);
        }
        
        // 处理当前的附件数据
        // 将fileList和materialList中的附件与产品关联
        // 这一步很重要，因为上传时可能使用的是临时entity_id
        if (fileList.length > 0 || materialList.length > 0) {
          try {
            // 更新图片附件关联
            const attachmentPromises = [];
            [...fileList, ...materialList].forEach(file => {
              if (file.response && file.response.data && file.response.data.id) {
                attachmentPromises.push(
                  request({
                    url: `/api/pallet/attachments/${file.response.data.id}`,
                    method: 'PUT',
                    data: {
                      entity_type: 'PRODUCT',
                      entity_id: productId
                    }
                  })
                );
              }
            });
            
            if (attachmentPromises.length > 0) {
              await Promise.all(attachmentPromises);
            }
          } catch (attachError) {
            console.error('更新附件关联失败:', attachError);
            // 不中断流程，继续执行
          }
        }
        
        // 调用成功回调
        if (onFinish) {
          onFinish(productId, savedProduct);
        }
      }
    } catch (error) {
      console.error('提交表单失败:', error);
      
      // 详细记录错误信息
      console.log('错误详情:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        config: error.config,
        request: error.request
      });
      
      // 处理常见错误情况
      if (error.response) {
        const { status, data } = error.response;
        
        console.log('服务器响应错误数据:', data);
        
        if (status === 409) {
          // 产品货号已存在的情况
          message.error('提交失败: 产品货号已存在，请修改后重试');
          // 设置表单字段错误状态
          form.setFields([
            {
              name: 'product_code',
              errors: ['产品货号已存在，请修改后重试']
            }
          ]);
        } else if (status === 400) {
          // 400错误可能是字段验证失败
          let errorMsg = '表单数据验证失败';
          if (data && data.message) {
            errorMsg = data.message;
            
            // 记录字段验证错误的详细信息
            console.log('字段验证错误:', data);
            
            // 尝试从错误信息中提取字段名
            const fieldMatch = errorMsg.match(/['"]([^'"]+)['"]/);
            if (fieldMatch && fieldMatch[1]) {
              const fieldName = fieldMatch[1];
              // 将错误标记到对应字段
              form.setFields([
                {
                  name: fieldName,
                  errors: [errorMsg]
                }
              ]);
            }
            
            // 尝试处理特定字段的错误
            if (errorMsg.includes('product_url')) {
              try {
                // 重新尝试提交，确保产品链接设置为空字符串
                const retryFormData = { ...formData, product_url: '' };
                console.log('尝试重新提交，设置product_url为空字符串:', retryFormData);
                
                if (isEdit) {
                  const response = await request({
                    url: `/api/pallet/products/${initialValues.id}`,
                    method: 'PUT',
                    data: retryFormData
                  });
                  
                  if (response && response.code === 200) {
                    productId = initialValues.id;
                    savedProduct = response.data;
                    message.success('产品更新成功');
                    
                    // 调用成功回调
                    if (onFinish) {
                      onFinish(productId, savedProduct);
                    }
                    
                    setSubmitting(false);
                    return; // 成功处理，提前返回
                  }
                }
              } catch (retryError) {
                console.error('重试提交失败:', retryError);
              }
            }
          }
          message.error(`提交失败: ${errorMsg}`);
        } else if (data && data.message) {
          // 服务器返回了具体错误信息
          message.error(`提交失败: ${data.message}`);
        } else {
          // 其他错误情况
          message.error(`提交失败: ${error.message || '未知错误'}`);
        }
      } else {
        // 网络错误等情况
        message.error(`提交失败: ${error.message || '未知错误'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 图片上传前的检查
  const beforeUpload = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件!');
    }
    
    const isLt20M = file.size / 1024 / 1024 < 20;
    if (!isLt20M) {
      message.error('图片大小不能超过20MB!');
    }
    
    return isImage && isLt20M;
  };

  // 素材包上传前的检查
  const beforeUploadMaterial = (file) => {
    const isZip = file.type === 'application/zip' || 
                 file.type === 'application/x-rar-compressed' || 
                 file.type === 'application/x-7z-compressed' ||
                 file.name.endsWith('.zip') || 
                 file.name.endsWith('.rar') || 
                 file.name.endsWith('.7z');
                 
    if (!isZip) {
      message.error('素材包只能上传zip/rar/7z格式!');
    }
    
    const isLt500M = file.size / 1024 / 1024 < 500;
    if (!isLt500M) {
      message.error('素材包大小不能超过500MB!');
    }
    
    return isZip && isLt500M;
  };

  // 处理图片上传变化
  const handleImageChange = ({ fileList }) => {
    // 检查是否删除了图片
    if (fileList.length === 0) {
      if (isEdit && initialValues.attachments) {
        // 查找被删除的图片附件ID
        const imageAttachment = initialValues.attachments.find(
          attachment => attachment.file_type === 'IMAGE'
        );
        
        if (imageAttachment && imageAttachment.id) {
          // 将被删除的附件ID添加到deletedAttachmentIds中
          setDeletedAttachmentIds(prev => [...prev, imageAttachment.id]);
          console.log('图片已删除，将删除图片附件ID:', imageAttachment.id);
        }
      }
      // 删除图片时立即清空文件名
      setImageFileName('');
    } else if (fileList.length > 0) {
      const file = fileList[0];
      // 仅当文件状态为done时才设置文件名
      if (file.status === 'done') {
        setImageFileName(file.name || '');
      }
    }
    
    setFileList(fileList.slice(-1)); // 只保留最新上传的一张图片
  };

  // 处理素材包上传变化
  const handleMaterialChange = ({ fileList }) => {
    // 检查是否删除了素材包
    if (fileList.length === 0) {
      if (isEdit && initialValues.attachments) {
        // 查找被删除的素材包附件ID
        const materialAttachment = initialValues.attachments.find(
          attachment => attachment.file_type === 'MATERIAL'
        );
        
        if (materialAttachment && materialAttachment.id) {
          // 将被删除的附件ID添加到deletedAttachmentIds中
          setDeletedAttachmentIds(prev => [...prev, materialAttachment.id]);
          console.log('素材包已删除，将删除素材包附件ID:', materialAttachment.id);
        }
      }
      // 删除素材包时立即清空文件名
      setMaterialFileName('');
    } else if (fileList.length > 0) {
      const file = fileList[0];
      // 仅当文件状态为done时才设置文件名
      if (file.status === 'done') {
        setMaterialFileName(file.name || '');
      }
    }
    
    setMaterialList(fileList.slice(-1)); // 只保留最新上传的一个素材包
  };

  // 自定义上传请求处理
  const customRequest = async ({ file, onSuccess, onError, onProgress }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entity_type', 'PRODUCT');
    formData.append('entity_id', isEdit ? initialValues.id : '0'); // 编辑模式使用产品ID，添加模式临时使用0
    
    // 记录上传参数
    console.log('附件上传参数:', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      isEdit,
      entityId: isEdit ? initialValues.id : '0',
      isImageFile: file.type.startsWith('image/')
    });
    
    try {
      // 根据文件类型选择不同的上传接口
      const isImage = file.type.startsWith('image/');
      const uploadUrl = isImage 
        ? '/api/pallet/attachments/image' 
        : '/api/pallet/attachments/material';
        
      const response = await request({
        url: uploadUrl,
        method: 'POST',
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: ({ total, loaded }) => {
          onProgress({ percent: Math.round((loaded / total) * 100) });
        }
      });
      
      // 记录上传响应
      console.log(`附件上传成功 - ${isImage ? '图片' : '素材包'}:`, {
        fileName: file.name,
        responseStatus: response.code,
        attachmentId: response.data?.id,
        filePath: response.data?.file_path
      });
      
      onSuccess(response);
    } catch (error) {
      console.error(`附件上传失败 - ${file.type.startsWith('image/') ? '图片' : '素材包'}:`, {
        fileName: file.name,
        error: error.message,
        status: error.response?.status,
        response: error.response?.data
      });
      onError(error);
    }
  };

  return (
    <div className={styles.productForm}>
      <h1 className={styles.formTitle}>{isEdit ? '编辑产品' : '添加产品'}</h1>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ price_tiers: [{ quantity: '', price: '' }] }}
        validateTrigger={['onChange', 'onBlur']}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="产品名称"
              name="name"
              rules={[{ required: true, message: '请输入产品名称' }]}
            >
              <Input placeholder="输入产品名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="品牌"
              name="brand_id"
            >
              <Select 
                placeholder="请选择品牌"
                dropdownStyle={{ zIndex: 1100 }}
                getPopupContainer={trigger => trigger.parentNode}
                allowClear
              >
                {brands.map(brand => (
                  <Option key={brand.id} value={brand.id}>{brand.name}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="货号"
              name="product_code"
              validateTrigger={['onChange', 'onBlur']}
            >
              <Input placeholder="如: BN00235" allowClear />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="规格"
              name="specification"
            >
              <Input placeholder="如: 10x6x2cm/片" allowClear />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="净含量"
              name="net_content"
            >
              <Input placeholder="如: 20片/包" allowClear />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="产品尺寸"
              name="product_size"
            >
              <Input placeholder="产品最小包装尺寸 如: 20x2x40cm/包" allowClear />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="包装方式"
              name="shipping_method"
            >
              <Input placeholder="如: 箱装/编织袋装" allowClear />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="包装规格"
              name="shipping_spec"
            >
              <Input placeholder="如: 60包/箱" allowClear />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="包装尺寸"
              name="shipping_size"
            >
              <Input placeholder="大包装尺寸 如: 69x66x152cm" allowClear />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="产品链接"
              name="product_url"
              validateTrigger={['onChange', 'onBlur']}
              rules={[
                {
                  validator: (_, value) => {
                    // 空值允许
                    if (!value || value.trim() === '') {
                      return Promise.resolve();
                    }
                    
                    let url = value.trim();
                    // 确保URL有http前缀
                    if (!url.match(/^https?:\/\//)) {
                      url = 'http://' + url;
                    }
                    
                    // 验证是否是有效的URL格式
                    const urlPattern = /^(https?:\/\/)(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:[0-9]+)?(\/[^\s]*)?$/;
                    if (urlPattern.test(url)) {
                      return Promise.resolve();
                    }
                    return Promise.reject('请输入有效的URL地址');
                  }
                }
              ]}
            >
              <Input placeholder="产品访问链接（可选）" allowClear />
            </Form.Item>
          </Col>
        </Row>

        <h3 className={styles.sectionTitle}>价格档位</h3>
        <Form.List name="price_tiers">
          {(fields, { add, remove }) => (
            <>
              <div className={styles.priceTierHeader}>
                <div className={styles.priceTierLabel}>数量</div>
                <div className={styles.priceTierLabel}>单价</div>
                <div className={styles.priceTierAction}></div>
              </div>
              {fields.length > 0 ? (
                fields.map(({ key, name, ...restField }, index) => (
                  <div key={key} className={styles.priceTierItem}>
                    <Form.Item
                      {...restField}
                      name={[name, 'quantity']}
                      className={styles.priceTierField}
                    >
                      <Input placeholder="一次性订购数量 如500包 即显示≤500包" allowClear />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'price']}
                      className={styles.priceTierField}
                    >
                      <Input placeholder="如2.6元/包 即订购500包以内价格2.6元" allowClear />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'id']} hidden>
                      <Input />
                    </Form.Item>
                    <div className={styles.priceTierButtons}>
                      <Button 
                        icon={<PlusOutlined />} 
                        onClick={() => add({ quantity: '', price: '' }, name + 1)} 
                        className={styles.priceTierAddBtn}
                        title="在此行下方插入新行"
                        style={{ width: 20, height: 20, minWidth: 20 }}
                      />
                      {fields.length > 1 && (
                        <Button 
                          danger 
                          icon={<MinusOutlined />} 
                          onClick={() => remove(name)} 
                          className={styles.priceTierRemoveBtn}
                          title="删除此行"
                          style={{ width: 20, height: 20, minWidth: 20 }}
                        />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.noPriceTiers}>
                  <Button
                    type="dashed"
                    onClick={() => add({ quantity: '', price: '' })}
                    icon={<PlusSquareOutlined />}
                  >
                    添加价格档位
                  </Button>
                </div>
              )}
            </>
          )}
        </Form.List>

        <Row gutter={16} className={styles.uploadsContainer}>
          <Col span={12}>
            <div className={styles.uploadSection}>
              <h3>产品图片</h3>
              <div className={styles.uploadBox}>
                <div className={styles.uploadContent}>
                  <Upload
                    name="file"
                    listType="picture-card"
                    fileList={fileList}
                    beforeUpload={beforeUpload}
                    onChange={handleImageChange}
                    customRequest={customRequest}
                    maxCount={1}
                    className={styles.productImageUpload}
                    showUploadList={{
                      showPreviewIcon: false,
                      showRemoveIcon: true,
                      showDownloadIcon: false
                    }}
                  >
                    {fileList.length >= 1 ? null : (
                      <div className={styles.uploadPlaceholder}>
                        <div className={styles.uploadImageIcon}></div>
                      </div>
                    )}
                  </Upload>
                  {fileList.length > 0 && fileList[0].status === 'done' && imageFileName && (
                    <div className={styles.fileName}>{imageFileName}</div>
                  )}
                </div>
                <div className={styles.uploadTips}>
                  <p>支持JPG/PNG/JPEG/GIF格式 小于20MB</p>
                </div>
              </div>
            </div>
          </Col>
          <Col span={12}>
            <div className={styles.uploadSection}>
              <h3>产品素材包</h3>
              <div className={styles.uploadBox}>
                <div className={styles.uploadContent}>
                  <Upload
                    name="file"
                    listType="picture-card"
                    fileList={materialList}
                    beforeUpload={beforeUploadMaterial}
                    onChange={handleMaterialChange}
                    customRequest={customRequest}
                    maxCount={1}
                    className={styles.materialUpload}
                    showUploadList={{
                      showPreviewIcon: false,
                      showRemoveIcon: true,
                      showDownloadIcon: false
                    }}
                    iconRender={() => (
                      <div className={styles.uploadMaterialIcon}></div>
                    )}
                  >
                    {materialList.length >= 1 ? null : (
                      <div className={styles.uploadPlaceholder}>
                        <div className={styles.uploadMaterialIcon}></div>
                      </div>
                    )}
                  </Upload>
                  {materialList.length > 0 && materialList[0].status === 'done' && materialFileName && (
                    <div className={styles.fileName}>{materialFileName}</div>
                  )}
                </div>
                <div className={styles.uploadTips}>
                  <p>支持RAR/ZIP/7Z格式 小于500MB</p>
                </div>
              </div>
            </div>
          </Col>
        </Row>

        <Form.Item className={styles.formActions}>
          <Button type="primary" htmlType="submit" loading={submitting} className={styles.submitBtn}>
            提交
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default ProductForm; 