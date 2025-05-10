import React, { useState, useEffect } from 'react';
import { Tabs, Button, Drawer, Space, message, Spin } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { getStaticContent, updateStaticContent } from '@/api/staticContent';
import styles from './StaticContentManagement.module.css';
import axios from 'axios';

// 引入wangEditor相关组件
import { Editor, Toolbar } from '@wangeditor/editor-for-react';
import '@wangeditor/editor/dist/css/style.css';

const { TabPane } = Tabs;

// 页面类型配置
const PAGE_TYPES = [
  { key: 'store-service', label: '对接店管家', description: '店铺管理系统对接服务说明' },
  { key: 'logistics', label: '快递/物流', description: '物流和快递服务相关说明' },
  { key: 'help-center', label: '帮助中心', description: '系统使用帮助和常见问题' },
];

const StaticContentManagement = () => {
  const { user } = useSelector(state => state.auth);
  const [activeKey, setActiveKey] = useState('store-service');
  const [contents, setContents] = useState({});
  const [loading, setLoading] = useState({});
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingContent, setEditingContent] = useState('');
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);

  // 加载静态内容
  useEffect(() => {
    PAGE_TYPES.forEach(({ key }) => {
      fetchContent(key);
    });
  }, []);

  // 销毁编辑器
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

  // 获取指定类型的静态内容
  const fetchContent = async (pageType) => {
    try {
      setLoading((prev) => ({ ...prev, [pageType]: true }));
      const response = await getStaticContent(pageType);
      if (response && response.data) {
        setContents((prev) => ({ 
          ...prev, 
          [pageType]: response.data.content || '暂无内容' 
        }));
      }
    } catch (error) {
      console.error(`获取${pageType}内容失败:`, error);
      message.error(`获取内容失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading((prev) => ({ ...prev, [pageType]: false }));
    }
  };

  // 打开编辑器
  const handleEdit = () => {
    setEditingContent(contents[activeKey] || '');
    setEditorVisible(true);
  };

  // 保存编辑内容
  const handleSave = async () => {
    if (!editor) return;
    
    try {
      setSaving(true);
      const html = editor.getHtml();
      
      await updateStaticContent(activeKey, html);
      message.success('内容已更新');
      
      // 更新本地内容
      setContents((prev) => ({ ...prev, [activeKey]: html }));
      setEditorVisible(false);
    } catch (error) {
      console.error('保存内容失败:', error);
      message.error(`保存失败: ${error.message || '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };

  // 自定义工具栏配置
  const toolbarConfig = {
    toolbarKeys: [
      'headerSelect',
      'blockquote',
      'bold',
      'underline',
      'italic',
      '|',
      'color',
      'bgColor',
      'fontSize',
      'fontFamily',
      'lineHeight',
      '|',
      'bulletedList',
      'numberedList',
      'todo',
      '|',
      'justifyLeft',
      'justifyCenter',
      'justifyRight',
      'justifyJustify',
      '|',
      'indent',
      'delIndent',
      '|',
      'insertLink',
      'uploadImage',
      'insertTable',
      'codeBlock',
      '|',
      'undo',
      'redo',
      'fullScreen'
    ]
  };

  // 编辑器配置
  const editorConfig = {
    placeholder: '请输入内容...',
    autoFocus: false,
    readOnly: false,
    MENU_CONF: {
      // 图片上传配置
      uploadImage: {
        // 自定义上传函数
        customUpload(file, insertFn) {
          // 创建FormData对象
          const formData = new FormData();
          formData.append('file', file);
          // 使用临时ID，表示这是编辑器上传的临时图片
          formData.append('entity_type', 'PRODUCT');
          formData.append('entity_id', '0'); // 使用0作为临时ID

          // 获取token
          const token = localStorage.getItem('auth_token');
          if (!token) {
            message.error('请先登录');
            return;
          }

          // 发送上传请求
          axios.post('/api/pallet/attachments/image', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${token}`
            }
          })
          .then(response => {
            if (response.data && response.data.code === 200) {
              // 构建图片完整URL
              const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
              const imageUrl = baseUrl.replace('/api', '') + response.data.data.file_path;
              
              // 插入图片到编辑器
              insertFn(imageUrl, file.name, imageUrl);
              message.success('图片上传成功');
            } else {
              message.error('图片上传失败：' + (response.data?.message || '未知错误'));
            }
          })
          .catch(error => {
            console.error('上传图片失败:', error);
            message.error('上传图片失败: ' + (error.message || '未知错误'));
          });
        }
      }
    }
  };

  // 渲染内容区域
  const renderContent = (pageType) => {
    if (loading[pageType]) {
      return <Spin className={styles.spinner} />;
    }

    return (
      <div 
        className={styles.contentViewer}
        dangerouslySetInnerHTML={{ __html: contents[pageType] || '暂无内容' }}
      />
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>静态内容管理</h2>
        {user?.is_admin && (
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={handleEdit}
          >
            编辑内容
          </Button>
        )}
      </div>

      <Tabs 
        activeKey={activeKey} 
        onChange={setActiveKey}
        className={styles.tabs}
      >
        {PAGE_TYPES.map(({ key, label, description }) => (
          <TabPane 
            tab={label} 
            key={key}
            className={styles.tabPane}
          >
            <div className={styles.description}>{description}</div>
            {renderContent(key)}
          </TabPane>
        ))}
      </Tabs>

      {/* 富文本编辑器抽屉 */}
      <Drawer
        title={`编辑${PAGE_TYPES.find(item => item.key === activeKey)?.label || ''}内容`}
        placement="right"
        width={1500}
        onClose={() => setEditorVisible(false)}
        open={editorVisible}
        extra={
          <Space>
            <Button onClick={() => setEditorVisible(false)}>取消</Button>
            <Button 
              type="primary" 
              onClick={handleSave}
              loading={saving}
            >
              保存
            </Button>
          </Space>
        }
      >
        <div className={styles.editorContainer}>
          <Toolbar
            editor={editor}
            defaultConfig={toolbarConfig}
            mode="default"
            style={{ borderBottom: '1px solid #ccc' }}
          />
          <Editor
            defaultConfig={editorConfig}
            value={editingContent}
            onCreated={setEditor}
            mode="default"
            style={{ height: 'calc(100vh - 250px)', overflowY: 'hidden' }}
          />
        </div>
      </Drawer>
    </div>
  );
};

export default StaticContentManagement; 