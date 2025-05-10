import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Upload, Table, message, App, Space, Popconfirm } from 'antd';
import { CameraOutlined, PlusOutlined, EditOutlined, DeleteOutlined, EyeInvisibleOutlined, EyeTwoTone, CheckCircleOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { getUserInfoAsync } from '../store/slices/authSlice';
import { getProfile, updateProfile, updatePassword, getStores, addStore, updateStore, deleteStore, uploadImage } from '../api/user';
import { getImageUrl, getApiBaseUrl } from '../config/urls';
import axios from 'axios';
import styles from './ProfileManagement.module.css';

const ProfileManagement = () => {
  const { message: antMessage } = App.useApp();
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);
  
  // 状态定义
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState([]);
  const [qrcodeUrl, setQrcodeUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  // 编辑相关状态
  const [editingKey, setEditingKey] = useState('');
  const [newStore, setNewStore] = useState(null);
  const [editForm] = Form.useForm();
  
  // 获取个人资料和店铺信息
  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const [profileRes, storesRes] = await Promise.all([
        getProfile(),
        getStores()
      ]);
      
      if (profileRes.data) {
        const profileData = profileRes.data;
        
        // 设置表单初始值
        profileForm.setFieldsValue({
          username: profileData.username,
          name: profileData.name,
          phone: profileData.phone,
          email: profileData.email,
          company: profileData.company
        });
        
        // 设置头像和二维码
        if (profileData.avatar) {
          // 添加时间戳避免缓存
          setAvatarUrl(getImageUrl(profileData.avatar, `?t=${Date.now()}`));
        }
        
        if (profileData.wechat_qrcode) {
          // 添加时间戳避免缓存
          setQrcodeUrl(getImageUrl(profileData.wechat_qrcode, `?t=${Date.now()}`));
        }
      }
      
      if (storesRes.data) {
        setStores(storesRes.data);
      }
    } catch (error) {
      console.error('获取个人资料失败:', error);
      antMessage.error('获取个人资料失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 组件加载时获取数据
  useEffect(() => {
    fetchProfileData();
  }, []);
  
  // 处理头像上传前的校验
  const beforeAvatarUpload = (file) => {
    const isImage = /\.(jpg|jpeg|png|gif)$/i.test(file.name);
    if (!isImage) {
      antMessage.error('只能上传JPG/PNG/JPEG/GIF格式图片!');
      return false;
    }
    
    const isLt20M = file.size / 1024 / 1024 < 20;
    if (!isLt20M) {
      antMessage.error('图片必须小于20MB!');
      return false;
    }
    
    return true; // 返回true允许上传
  };
  
  // 自定义头像上传
  const handleAvatarChange = async (info) => {
    if (info.file.status !== 'uploading') {
      console.log(info.file, info.fileList);
    }
    
    if (info.file.status === 'done') {
      if (info.file.response && info.file.response.success) {
        const imageUrl = getImageUrl(info.file.response.data.file_path, `?t=${Date.now()}`);
        setAvatarUrl(imageUrl);
        
        // 显示成功提示
        antMessage.success({
          content: '头像上传成功',
          duration: 3,
          style: {
            fontSize: '16px',
            marginTop: '20vh',
          },
        });
        
        // 刷新用户信息
        dispatch(getUserInfoAsync());
      } else {
        antMessage.error({
          content: info.file.response?.message || '头像上传失败，请稍后重试',
          duration: 5,
          style: {
            fontSize: '16px',
            marginTop: '20vh',
          },
        });
      }
    } else if (info.file.status === 'error') {
      antMessage.error({
        content: '头像上传失败，请稍后重试',
        duration: 5,
        style: {
          fontSize: '16px',
          marginTop: '20vh',
        },
      });
    }
  };
  
  // 处理二维码上传
  const handleQrcodeUpload = async (info) => {
    if (info.file.status !== 'uploading') {
      console.log(info.file, info.fileList);
    }
    
    if (info.file.status === 'done') {
      if (info.file.response && info.file.response.success) {
        const imageUrl = getImageUrl(info.file.response.data.file_path, `?t=${Date.now()}`);
        setQrcodeUrl(imageUrl);
        
        // 显示成功提示
        antMessage.success({
          content: '二维码上传成功',
          duration: 3,
          style: {
            fontSize: '16px',
            marginTop: '20vh',
          },
        });
        
        // 刷新用户信息
        dispatch(getUserInfoAsync());
      } else {
        antMessage.error({
          content: info.file.response?.message || '二维码上传失败，请稍后重试',
          duration: 5,
          style: {
            fontSize: '16px',
            marginTop: '20vh',
          },
        });
      }
    } else if (info.file.status === 'error') {
      antMessage.error({
        content: '二维码上传失败，请稍后重试',
        duration: 5,
        style: {
          fontSize: '16px',
          marginTop: '20vh',
        },
      });
    }
  };
  
  // 密码验证
  const validateConfirmPassword = (_, value) => {
    const newPassword = profileForm.getFieldValue('new_password');
    if ((!newPassword && !value) || !value) {
      return Promise.resolve();
    }
    if (newPassword && value && newPassword !== value) {
      return Promise.reject(new Error('两次输入的密码不一致'));
    }
    return Promise.resolve();
  };
  
  // 提交个人资料表单
  const handleProfileSubmit = async () => {
    try {
      console.log('表单提交开始...');
      // 获取表单值
      const profileValues = await profileForm.validateFields();
      setLoading(true);
      
      // 检查是否有密码相关输入
      const newPassword = profileForm.getFieldValue('new_password');
      const confirmPassword = profileForm.getFieldValue('confirm_password');
      
      console.log('准备更新个人资料...');
      // 个人信息更新
      const profileUpdateRes = await updateProfile(profileValues);
      console.log('个人资料更新结果:', profileUpdateRes);
      
      // 如果填写了密码，则同时更新密码
      let passwordUpdateRes = { success: true };
      if (newPassword) {
        console.log('准备更新密码...');
        passwordUpdateRes = await updatePassword({ new_password: newPassword });
        console.log('密码更新结果:', passwordUpdateRes);
      }
      
      if (profileUpdateRes.success && passwordUpdateRes.success) {
        // 成功提示 - 使用大号全局提示
        console.log('更新成功，显示成功提示...');
        const successMessage = newPassword ? '个人资料和密码已更新' : '个人资料已更新';
        
        // 使用全局提示，设置更长的显示时间和更大的字体
        antMessage.success({
          content: successMessage,
          duration: 5, // 显示5秒
          style: {
            fontSize: '16px',
            marginTop: '20vh',
          },
        });
        
        // 如果更新了密码，延迟跳转到登录页
        if (newPassword) {
          // 延迟1.5秒后登出并跳转到登录页面
          setTimeout(() => {
            // 清除本地存储的token
            localStorage.removeItem('auth_token');
            
            // 跳转到登录页
            window.location.href = '/login';
          }, 1500);
        } else {
          // 刷新用户信息
          dispatch(getUserInfoAsync());
        }
      } else {
        // 失败提示，使用全局提示
        console.log('更新失败，显示错误提示...');
        let errorMsg = '';
        if (!profileUpdateRes.success) {
          errorMsg += `个人资料更新失败: ${profileUpdateRes.message || '未知错误'}\n`;
        }
        if (!passwordUpdateRes.success) {
          errorMsg += `密码修改失败: ${passwordUpdateRes.message || '未知错误'}`;
        }
        
        // 使用全局提示，设置更长的显示时间和更大的字体
        antMessage.error({
          content: errorMsg || '操作失败，请稍后重试',
          duration: 8, // 显示8秒
          style: {
            fontSize: '16px',
            marginTop: '20vh',
          },
        });
      }
    } catch (error) {
      console.error('更新失败:', error);
      
      // 生成错误信息
      let errorContent = '';
      if (error.errorFields) {
        errorContent = '请检查以下问题: ' + 
          error.errorFields.map(field => `${field.errors.join(', ')}`).join('; ');
      } else {
        errorContent = error.message || '更新失败，请稍后重试';
      }
      
      // 使用全局提示，设置更长的显示时间和更大的字体
      antMessage.error({
        content: errorContent || '表单验证失败',
        duration: 8, // 显示8秒
        style: {
          fontSize: '16px',
          marginTop: '20vh',
        },
      });
    } finally {
      setLoading(false);
    }
  };
  
  // 判断是否正在编辑某行
  const isEditing = (record) => record.id === editingKey;
  
  // 修改编辑店铺的方法
  const edit = (record) => {
    editForm.setFieldsValue({
      platform: record.platform || '',
      name: record.name || '',
      url: record.url || '',
      ...record,
    });
    setEditingKey(record.id);
  };
  
  // 取消编辑
  const cancel = () => {
    setEditingKey('');
    if (newStore) {
      setStores(stores.filter(store => store.id !== newStore.id));
      setNewStore(null);
    }
  };
  
  // 保存编辑内容
  const save = async (key) => {
    try {
      const row = await editForm.validateFields();
      const newData = [...stores];
      const index = newData.findIndex((item) => key === item.id);
      
      if (index > -1) {
        const item = newData[index];
        
        // 判断是新添加的还是编辑现有的
        if (newStore && key === newStore.id) {
          // 新增店铺
          const res = await addStore(row);
          if (res.success) {
            // 重新获取店铺列表
            const storesRes = await getStores();
            if (storesRes.data) {
              setStores(storesRes.data);
              setNewStore(null);
              setEditingKey('');
              
              // 成功提示
              antMessage.success({
                content: '店铺添加成功',
                duration: 3,
                style: {
                  fontSize: '16px',
                  marginTop: '20vh',
                },
              });
            }
          } else {
            antMessage.error({
              content: res.message || '店铺添加失败，请稍后重试',
              duration: 5,
              style: {
                fontSize: '16px',
                marginTop: '20vh',
              },
            });
          }
        } else {
          // 更新现有店铺
          const res = await updateStore(key, row);
          if (res.success) {
            newData.splice(index, 1, { ...item, ...row });
            setStores(newData);
            setEditingKey('');
            
            // 成功提示
            antMessage.success({
              content: '店铺信息更新成功',
              duration: 3,
              style: {
                fontSize: '16px',
                marginTop: '20vh',
              },
            });
          } else {
            antMessage.error({
              content: res.message || '店铺信息更新失败，请稍后重试',
              duration: 5,
              style: {
                fontSize: '16px',
                marginTop: '20vh',
              },
            });
          }
        }
      } else {
        antMessage.error({
          content: '找不到该店铺，请刷新页面后重试',
          duration: 5,
          style: {
            fontSize: '16px',
            marginTop: '20vh',
          },
        });
      }
    } catch (errInfo) {
      antMessage.error({
        content: '请检查输入内容是否正确',
        duration: 5,
        style: {
          fontSize: '16px',
          marginTop: '20vh',
        },
      });
      console.log('验证失败:', errInfo);
    }
  };
  
  // 删除店铺
  const handleDeleteStore = async (id) => {
    setLoading(true);
    try {
      const res = await deleteStore(id);
      if (res.success) {
        // 成功提示
        antMessage.success({
          content: '店铺已删除',
          duration: 3,
          style: {
            fontSize: '16px',
            marginTop: '20vh',
          },
        });
        
        // 重新获取店铺列表
        const storesRes = await getStores();
        if (storesRes.data) {
          setStores(storesRes.data);
        }
      } else {
        antMessage.error({
          content: res.message || '店铺删除失败，请稍后重试',
          duration: 5,
          style: {
            fontSize: '16px',
            marginTop: '20vh',
          },
        });
      }
    } catch (error) {
      console.error('删除店铺失败:', error);
      antMessage.error({
        content: '店铺删除失败，请稍后重试',
        duration: 5,
        style: {
          fontSize: '16px',
          marginTop: '20vh',
        },
      });
    } finally {
      setLoading(false);
    }
  };
  
  // 添加新店铺行 - 修改为在指定行之后插入
  const addNewStoreRow = (record) => {
    // 创建临时ID
    const tempId = 'new-' + Date.now();
    const newStoreData = {
      id: tempId,
      platform: '',
      name: '',
      url: ''
    };
    
    // 在当前行之后插入
    const newData = [...stores];
    if (record) {
      // 如果指定了行，就在该行之后插入
      const index = newData.findIndex(item => item.id === record.id);
      newData.splice(index + 1, 0, newStoreData);
    } else {
      // 如果没有指定行，则添加到末尾
      newData.push(newStoreData);
    }
    
    setStores(newData);
    setNewStore(newStoreData);
    setEditingKey(tempId);
    
    // 初始化表单值
    editForm.setFieldsValue({
      platform: '',
      name: '',
      url: ''
    });
  };
  
  // 可编辑单元格组件
  const EditableCell = ({
    editing,
    dataIndex,
    title,
    inputType,
    record,
    index,
    children,
    ...restProps
  }) => {
    // 处理按键事件
    const handleKeyPress = (e) => {
      // 如果是url字段且按下了回车键
      if (dataIndex === 'url' && e.key === 'Enter') {
        e.preventDefault(); // 阻止默认行为
        save(record.id); // 保存当前编辑的行
      }
    };
    
    return (
      <td {...restProps}>
        {editing ? (
          <Form.Item
            name={dataIndex}
            style={{ margin: 0 }}
            rules={[
              {
                required: true,
                message: `请输入${title}!`,
              },
            ]}
          >
            <Input onKeyPress={handleKeyPress} />
          </Form.Item>
        ) : (
          children
        )}
      </td>
    );
  };
  
  // 更新表格列定义
  const storeColumns = [
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      editable: true,
      width: '20%',
    },
    {
      title: '店铺名称',
      dataIndex: 'name',
      key: 'name',
      editable: true,
      width: '25%',
    },
    {
      title: '店铺地址',
      dataIndex: 'url',
      key: 'url',
      editable: true,
      width: '40%',
      render: (text, record) => {
        const editable = isEditing(record);
        return editable ? (
          <Form.Item
            name="url"
            style={{ margin: 0 }}
            rules={[{ required: true, message: '请输入店铺地址' }]}
          >
            <Input 
              placeholder="请输入店铺地址"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  save(record.id);
                }
              }}
            />
          </Form.Item>
        ) : (
          <a href={text} target="_blank" rel="noopener noreferrer">{text}</a>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: '15%',
      render: (_, record) => {
        const editable = isEditing(record);
        return editable ? (
          <Space>
            <Button
              type="link"
              icon={<SaveOutlined />}
              onClick={() => save(record.id)}
              style={{ padding: 0 }}
            />
            <Button
              type="link"
              icon={<CloseOutlined />}
              onClick={cancel}
              style={{ padding: 0 }}
              danger
            />
          </Space>
        ) : (
          <Space>
            <Button
              type="link"
              disabled={editingKey !== ''}
              icon={<EditOutlined />}
              onClick={() => edit(record)}
              style={{ padding: 0 }}
            />
            <Popconfirm
              title="确定要删除这个店铺吗？"
              onConfirm={() => handleDeleteStore(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                disabled={editingKey !== ''}
                icon={<DeleteOutlined />}
                style={{ padding: 0 }}
                danger
              />
            </Popconfirm>
            {!newStore && (
              <Button
                type="link"
                disabled={editingKey !== ''}
                icon={<PlusOutlined />}
                onClick={() => addNewStoreRow(record)}
                style={{ padding: 0 }}
              />
            )}
          </Space>
        );
      },
    },
  ];
  
  // 处理可编辑列
  const mergedColumns = storeColumns.map((col) => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: (record) => ({
        record,
        dataIndex: col.dataIndex,
        title: col.title,
        editing: isEditing(record),
      }),
    };
  });
  
  // 获取上传接口URL
  const getUploadUrl = () => {
    return `${getApiBaseUrl()}/api/pallet/attachments/image`;
  };
  
  // 自定义请求头
  const getUploadHeaders = () => {
    return {
      Authorization: `Bearer ${localStorage.getItem('auth_token')}`
    };
  };
  
  // 组件渲染
  return (
    <div className={styles.profileContainer}>
      <h2 className={styles.pageTitle}>个人资料</h2>
      
      <div className={styles.formSection}>
        {/* 头像上传区域 */}
        <div className={styles.avatarSection}>
          <div className={styles.avatarUpload}>
            <Upload
              name="file"
              listType="picture-card"
              showUploadList={false}
              action={getUploadUrl()}
              headers={getUploadHeaders()}
              beforeUpload={beforeAvatarUpload}
              onChange={handleAvatarChange}
              data={{
                entity_type: 'USER',
                entity_id: user?.id,
                upload_type: 'avatar',
                replace_existing: 'true'
              }}
            >
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt="头像" 
                  className={styles.avatarImage}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                  onError={(e) => {
                    console.error('头像加载失败:', e);
                    e.target.src = '';
                  }}
                />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  <CameraOutlined className={styles.cameraIcon} />
                </div>
              )}
              <div className={styles.avatarOverlay}>
                <span>选择头像</span>
              </div>
            </Upload>
          </div>
        </div>
        
        {/* 个人信息表单 */}
        <Form
          form={profileForm}
          layout="horizontal"
          labelCol={{ span: 6 }}
          wrapperCol={{ span: 16 }}
          className={styles.profileForm}
          onFinish={handleProfileSubmit}
        >
          {/* 用户名和姓名一行 */}
          <div className={styles.profileFormRow}>
            <div className={styles.profileFormCol}>
              <Form.Item
                label="用户名"
                name="username"
              >
                <Input disabled />
              </Form.Item>
            </div>
            <div className={styles.profileFormCol}>
              <Form.Item
                label="姓名"
                name="name"
                rules={[
                  { required: true, message: '请输入姓名' },
                  { min: 2, max: 50, message: '姓名长度必须在2-50个字符之间' }
                ]}
              >
                <Input placeholder="请输入姓名" />
              </Form.Item>
            </div>
          </div>
          
          {/* 电话和邮箱一行 */}
          <div className={styles.profileFormRow}>
            <div className={styles.profileFormCol}>
              <Form.Item
                label="电话"
                name="phone"
                rules={[
                  { required: true, message: '请输入电话号码' },
                  { pattern: /^[0-9]{11}$/, message: '请输入11位手机号码' }
                ]}
              >
                <Input placeholder="请输入电话号码" />
              </Form.Item>
            </div>
            <div className={styles.profileFormCol}>
              <Form.Item
                label="邮箱"
                name="email"
                rules={[
                  { pattern: /^[^@]+@[^@]+\.[^@]+$/, message: '请输入有效的邮箱地址' }
                ]}
              >
                <Input placeholder="请输入邮箱" />
              </Form.Item>
            </div>
          </div>
          
          {/* 所属公司单独一行 */}
          <div className={styles.singleLine}>
            <Form.Item
              label="所属公司"
              name="company"
              labelCol={{ span: 3 }}
              wrapperCol={{ span: 20 }}
            >
              <Input placeholder="请输入所属公司" />
            </Form.Item>
          </div>
          
          {/* 密码修改区域 */}
          <Form.Item 
            label="密码"
            labelCol={{ span: 3 }}
            wrapperCol={{ span: 20 }}
          >
            <div className={styles.passwordContainer}>
              <div className={styles.passwordRow}>
                <div className={styles.passwordCol}>
                  <Form.Item
                    name="new_password"
                    label="新密码"
                    rules={[
                      { min: 6, message: '密码长度不能少于6位' }
                    ]}
                  >
                    <Input.Password
                      placeholder="不填写则不修改密码"
                      iconRender={visible => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                    />
                  </Form.Item>
                </div>
                <div className={styles.passwordCol}>
                  <Form.Item
                    name="confirm_password"
                    label="确认密码"
                    dependencies={['new_password']}
                    rules={[
                      ({ getFieldValue }) => ({
                        validator: (_, value) => {
                          const newPassword = getFieldValue('new_password');
                          if ((!newPassword && !value) || !value) {
                            return Promise.resolve();
                          }
                          if (newPassword && value && newPassword !== value) {
                            return Promise.reject(new Error('两次输入的密码不一致'));
                          }
                          return Promise.resolve();
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      placeholder="确认密码必须与新密码一致"
                      iconRender={visible => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                    />
                  </Form.Item>
                </div>
              </div>
            </div>
          </Form.Item>
          
          {/* 店铺管理区域 */}
          <div className={styles.storeSection}>
            <div className={styles.storeHeader}>
              <h3 className={styles.storeTitle}>店铺管理</h3>
              {stores.length === 0 && !newStore && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => addNewStoreRow(null)}
                  disabled={editingKey !== ''}
                >
                  添加店铺
                </Button>
              )}
            </div>
            
            <Form form={editForm} component="div">
              <Table
                components={{
                  body: {
                    cell: EditableCell,
                  },
                }}
                dataSource={stores}
                columns={mergedColumns}
                rowKey="id"
                pagination={false}
                loading={loading}
                size="middle"
                bordered
                className={styles.storeTable}
              />
            </Form>
          </div>
          
          {/* 微信二维码区域 */}
          <div className={styles.qrcodeSection}>
            <h3 className={styles.qrcodeTitle}>微信二维码</h3>
            
            <div className={styles.qrcodeUpload}>
              <div className={styles.qrcodePreview}>
                {qrcodeUrl ? (
                  <img 
                    src={qrcodeUrl} 
                    alt="微信二维码" 
                    className={styles.qrcodeImage}
                    onError={(e) => {
                      console.error('二维码加载失败:', e);
                      e.target.src = '';
                    }}
                  />
                ) : (
                  <span>暂无二维码</span>
                )}
              </div>
              
              <Upload
                name="file"
                showUploadList={false}
                action={getUploadUrl()}
                headers={getUploadHeaders()}
                beforeUpload={beforeAvatarUpload}
                onChange={handleQrcodeUpload}
                data={{
                  entity_type: 'USER',
                  entity_id: user?.id,
                  upload_type: 'qrcode',
                  replace_existing: 'true'
                }}
              >
                <Button type="primary">选择二维码</Button>
              </Upload>
              
              <div className={styles.qrcodeHint}>
                图片最大不超过20MB，支持JPG、PNG、JPEG、GIF格式，建议尺寸800×800像素
              </div>
            </div>
          </div>
          
          {/* 提交按钮 */}
          <div className={styles.submitSection}>
            <Button
              type="primary"
              htmlType="submit"
              className={styles.submitButton}
              loading={loading}
            >
              提交
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
};

// 使用App上下文包装组件
const ProfileManagementWithApp = (props) => (
  <App>
    <ProfileManagement {...props} />
  </App>
);

export default ProfileManagementWithApp; 