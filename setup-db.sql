--
-- 帮你品牌货盘管理系统数据库初始化脚本
-- 基于完整的数据库结构导出的精简版本，保留了所有表结构、视图和索引
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--
-- 用户表
--
CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password character varying(255) NOT NULL,
    name character varying(100),
    phone character varying(20),
    email character varying(100),
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    is_admin boolean DEFAULT false,
    created_by integer,
    last_login_time timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company character varying(100),
    avatar character varying(255),
    wechat_qrcode character varying(255),
    updated_by integer
);

COMMENT ON TABLE public.users IS '用户表';
COMMENT ON COLUMN public.users.username IS '用户名';
COMMENT ON COLUMN public.users.password IS '密码';
COMMENT ON COLUMN public.users.name IS '姓名';
COMMENT ON COLUMN public.users.phone IS '电话';
COMMENT ON COLUMN public.users.email IS '邮箱';
COMMENT ON COLUMN public.users.status IS '状态(ACTIVE/INACTIVE)';
COMMENT ON COLUMN public.users.is_admin IS '是否管理员(true=管理员,false=销售员)';
COMMENT ON COLUMN public.users.created_by IS '创建人ID(管理员)';
COMMENT ON COLUMN public.users.last_login_time IS '最后登录时间';
COMMENT ON COLUMN public.users.created_at IS '创建时间';
COMMENT ON COLUMN public.users.updated_at IS '更新时间';
COMMENT ON COLUMN public.users.company IS '所属公司';
COMMENT ON COLUMN public.users.avatar IS '用户头像URL';
COMMENT ON COLUMN public.users.wechat_qrcode IS '微信二维码URL';

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

--
-- 品牌表
--
CREATE TABLE public.brands (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    created_by integer NOT NULL,
    updated_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.brands_id_seq OWNED BY public.brands.id;

--
-- 产品表
--
CREATE TABLE public.products (
    id integer NOT NULL,
    owner_type character varying(20) DEFAULT 'COMPANY'::character varying NOT NULL,
    owner_id integer,
    name character varying(255) NOT NULL,
    brand_id integer,
    product_code character varying(100),
    specification character varying(255),
    net_content character varying(100),
    product_size character varying(100),
    shipping_method character varying(100),
    shipping_spec character varying(100),
    shipping_size character varying(100),
    product_url character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    updated_by integer,
    deleted_at timestamp without time zone
);

COMMENT ON COLUMN public.products.deleted_at IS '删除时间，NULL表示未删除，非NULL表示已移入回收站';

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;

--
-- 价格梯度表
--
CREATE TABLE public.price_tiers (
    id integer NOT NULL,
    product_id integer NOT NULL,
    quantity character varying(100) NOT NULL,
    price character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL
);

CREATE SEQUENCE public.price_tiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.price_tiers_id_seq OWNED BY public.price_tiers.id;

--
-- 附件表
--
CREATE TABLE public.attachments (
    id integer NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer NOT NULL,
    file_name character varying(255),
    file_type character varying(20) NOT NULL,
    file_path character varying(255) NOT NULL,
    file_size bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer
);

CREATE SEQUENCE public.attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.attachments_id_seq OWNED BY public.attachments.id;

--
-- 回收站表
--
CREATE TABLE public.recycle_bin (
    id integer NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer NOT NULL,
    owner_type character varying(20) NOT NULL,
    owner_id integer NOT NULL,
    deleted_by integer NOT NULL,
    deleted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    restored_by integer,
    restored_at timestamp without time zone
);

CREATE SEQUENCE public.recycle_bin_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.recycle_bin_id_seq OWNED BY public.recycle_bin.id;

--
-- 店铺表
--
CREATE TABLE public.stores (
    id integer NOT NULL,
    platform character varying(50),
    name character varying(100),
    url character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.stores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.stores_id_seq OWNED BY public.stores.id;

--
-- 用户店铺关联表
--
CREATE TABLE public.user_stores (
    id integer NOT NULL,
    user_id integer NOT NULL,
    store_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.user_stores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.user_stores_id_seq OWNED BY public.user_stores.id;

--
-- 仪表盘统计表
--
CREATE TABLE public.dashboard_stats (
    id integer NOT NULL,
    total_products integer DEFAULT 0 NOT NULL,
    total_users integer DEFAULT 0 NOT NULL,
    total_brands integer DEFAULT 0 NOT NULL,
    total_stores integer DEFAULT 0 NOT NULL,
    snapshot_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.dashboard_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.dashboard_stats_id_seq OWNED BY public.dashboard_stats.id;

--
-- 访问日志表
--
CREATE TABLE public.access_logs (
    id integer NOT NULL,
    user_id integer NOT NULL,
    page_url character varying(255) NOT NULL,
    access_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    session_duration integer,
    duration integer,
    CONSTRAINT chk_duration_positive CHECK ((duration >= 0))
);

COMMENT ON COLUMN public.access_logs.duration IS '访问停留时长(秒)，NULL表示未记录';

CREATE SEQUENCE public.access_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.access_logs_id_seq OWNED BY public.access_logs.id;

--
-- 货盘分享表
--
CREATE TABLE public.pallet_shares (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(64) NOT NULL,
    share_type character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_accessed timestamp without time zone,
    access_count integer DEFAULT 0,
    pallet_type character varying(20)
);

COMMENT ON COLUMN public.pallet_shares.pallet_type IS '货盘类型(COMPANY=公司总货盘,SELLER=销售员个人货盘)';

CREATE SEQUENCE public.pallet_shares_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.pallet_shares_id_seq OWNED BY public.pallet_shares.id;

--
-- 客户访问日志表
--
CREATE TABLE public.customer_logs (
    id integer NOT NULL,
    share_id integer NOT NULL,
    ip_address character varying(45),
    user_agent text,
    access_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.customer_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.customer_logs_id_seq OWNED BY public.customer_logs.id;

--
-- 静态页面表
--
CREATE TABLE public.static_pages (
    id integer NOT NULL,
    page_type character varying(20) NOT NULL,
    content text NOT NULL,
    updated_by integer NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE SEQUENCE public.static_pages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.static_pages_id_seq OWNED BY public.static_pages.id;

--
-- 用户分页设置表
--
CREATE TABLE public.user_pagination_settings (
    user_id integer NOT NULL,
    page_size integer DEFAULT 10 NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_pagination_settings_page_size_check CHECK ((page_size = ANY (ARRAY[10, 20, 50, 100])))
);

--
-- 设置默认值
--
ALTER TABLE ONLY public.access_logs ALTER COLUMN id SET DEFAULT nextval('public.access_logs_id_seq'::regclass);
ALTER TABLE ONLY public.attachments ALTER COLUMN id SET DEFAULT nextval('public.attachments_id_seq'::regclass);
ALTER TABLE ONLY public.brands ALTER COLUMN id SET DEFAULT nextval('public.brands_id_seq'::regclass);
ALTER TABLE ONLY public.customer_logs ALTER COLUMN id SET DEFAULT nextval('public.customer_logs_id_seq'::regclass);
ALTER TABLE ONLY public.dashboard_stats ALTER COLUMN id SET DEFAULT nextval('public.dashboard_stats_id_seq'::regclass);
ALTER TABLE ONLY public.pallet_shares ALTER COLUMN id SET DEFAULT nextval('public.pallet_shares_id_seq'::regclass);
ALTER TABLE ONLY public.price_tiers ALTER COLUMN id SET DEFAULT nextval('public.price_tiers_id_seq'::regclass);
ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);
ALTER TABLE ONLY public.recycle_bin ALTER COLUMN id SET DEFAULT nextval('public.recycle_bin_id_seq'::regclass);
ALTER TABLE ONLY public.static_pages ALTER COLUMN id SET DEFAULT nextval('public.static_pages_id_seq'::regclass);
ALTER TABLE ONLY public.stores ALTER COLUMN id SET DEFAULT nextval('public.stores_id_seq'::regclass);
ALTER TABLE ONLY public.user_stores ALTER COLUMN id SET DEFAULT nextval('public.user_stores_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

--
-- 主键约束
--
ALTER TABLE ONLY public.access_logs ADD CONSTRAINT access_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.attachments ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.brands ADD CONSTRAINT brands_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.customer_logs ADD CONSTRAINT customer_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.dashboard_stats ADD CONSTRAINT dashboard_stats_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pallet_shares ADD CONSTRAINT pallet_shares_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.price_tiers ADD CONSTRAINT price_tiers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.recycle_bin ADD CONSTRAINT recycle_bin_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.static_pages ADD CONSTRAINT static_pages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.stores ADD CONSTRAINT stores_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_pagination_settings ADD CONSTRAINT user_pagination_settings_pkey PRIMARY KEY (user_id);
ALTER TABLE ONLY public.user_stores ADD CONSTRAINT user_stores_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- 添加唯一约束
--
ALTER TABLE ONLY public.users ADD CONSTRAINT users_username_key UNIQUE (username);

--
-- 索引
--
CREATE INDEX idx_access_time ON public.access_logs USING btree (access_time);
CREATE INDEX idx_admin_users ON public.users USING btree (is_admin) WHERE (is_admin = true);
CREATE INDEX idx_attachment_entity ON public.attachments USING btree (entity_type, entity_id);
CREATE INDEX idx_customer_log_share ON public.customer_logs USING btree (share_id);
CREATE INDEX idx_customer_log_time ON public.customer_logs USING btree (access_time);
CREATE INDEX idx_pallet_share_token ON public.pallet_shares USING btree (token);
CREATE INDEX idx_pallet_share_user ON public.pallet_shares USING btree (user_id);
CREATE INDEX idx_products_deleted_at ON public.products USING btree (deleted_at);
CREATE INDEX idx_products_sort_code ON public.products USING btree (product_code);
CREATE INDEX idx_products_sort_name ON public.products USING btree (name);
CREATE INDEX idx_products_sort_updated ON public.products USING btree (updated_at);
CREATE INDEX idx_recycle_entity ON public.recycle_bin USING btree (entity_type, entity_id);
CREATE INDEX idx_recycle_owner ON public.recycle_bin USING btree (owner_type, owner_id);
CREATE INDEX idx_seller_products ON public.products USING btree (owner_type, owner_id) WHERE ((owner_type)::text = 'SELLER'::text);
CREATE INDEX idx_snapshot_time ON public.dashboard_stats USING btree (snapshot_time);
CREATE INDEX idx_user_access ON public.access_logs USING btree (user_id, access_time);
CREATE INDEX idx_user_login ON public.users USING btree (username, phone, email);
CREATE INDEX idx_users_search ON public.users USING btree (username, name, phone);

--
-- 外键约束
--
ALTER TABLE ONLY public.attachments ADD CONSTRAINT attachments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.access_logs ADD CONSTRAINT fk_access_logs_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.brands ADD CONSTRAINT fk_brands_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.brands ADD CONSTRAINT fk_brands_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.customer_logs ADD CONSTRAINT fk_customer_logs_share_id FOREIGN KEY (share_id) REFERENCES public.pallet_shares(id);
ALTER TABLE ONLY public.pallet_shares ADD CONSTRAINT fk_pallet_shares_user_id FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.price_tiers ADD CONSTRAINT fk_price_tiers_product_id FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.products ADD CONSTRAINT fk_products_brand_id FOREIGN KEY (brand_id) REFERENCES public.brands(id);
ALTER TABLE ONLY public.products ADD CONSTRAINT fk_products_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.recycle_bin ADD CONSTRAINT fk_recycle_bin_deleted_by FOREIGN KEY (deleted_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.recycle_bin ADD CONSTRAINT fk_recycle_bin_restored_by FOREIGN KEY (restored_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.static_pages ADD CONSTRAINT fk_static_pages_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.user_pagination_settings ADD CONSTRAINT user_pagination_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_stores ADD CONSTRAINT fk_user_stores_store_id FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_stores ADD CONSTRAINT fk_user_stores_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.users ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.users ADD CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.products ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

--
-- 视图
--
CREATE VIEW public.v_company_products AS
 SELECT p.id,
    p.owner_type,
    p.owner_id,
    p.name,
    p.brand_id,
    p.product_code,
    p.specification,
    p.net_content,
    p.product_size,
    p.shipping_method,
    p.shipping_spec,
    p.shipping_size,
    p.product_url,
    p.created_at,
    p.updated_at,
    p.created_by,
    p.updated_by,
    p.deleted_at,
    b.name AS brand_name
   FROM (public.products p
     JOIN public.brands b ON ((p.brand_id = b.id)))
  WHERE (((p.owner_type)::text = 'COMPANY'::text) AND (p.deleted_at IS NULL));

CREATE VIEW public.v_login_auth AS
 SELECT id,
    username,
    phone,
    email,
    password,
    status,
    is_admin
   FROM public.users
  WHERE ((status)::text = 'ACTIVE'::text);

CREATE VIEW public.v_seller_dashboard AS
 SELECT id AS user_id,
    ( SELECT count(*) AS count
           FROM public.products p
          WHERE (((p.owner_type)::text = 'SELLER'::text) AND (p.owner_id = u.id))) AS product_count,
    ( SELECT count(*) AS count
           FROM public.access_logs a
          WHERE ((a.user_id = u.id) AND (a.access_time >= (CURRENT_DATE - '7 days'::interval)))) AS weekly_visits,
    ( SELECT count(*) AS count
           FROM public.recycle_bin r
          WHERE (((r.owner_type)::text = 'SELLER'::text) AND (r.owner_id = u.id))) AS recycle_count,
    ( SELECT count(*) AS count
           FROM public.pallet_shares ps
          WHERE (ps.user_id = u.id)) AS share_count
   FROM public.users u
  WHERE (is_admin = false);

CREATE VIEW public.v_seller_recycle_bin AS
 SELECT r.id,
    r.entity_type,
    r.entity_id,
    r.owner_type,
    r.owner_id,
    r.deleted_by,
    r.deleted_at,
    r.restored_by,
    r.restored_at,
    p.name AS product_name
   FROM (public.recycle_bin r
     JOIN public.products p ON ((r.entity_id = p.id)))
  WHERE ((r.owner_type)::text = 'SELLER'::text);

--
-- 初始管理员账户 (密码: admin123)
--
INSERT INTO public.users (username, password, name, status, is_admin, company) 
VALUES ('admin', '$2b$10$3Kq3LUMljiYKNK9fPlO8nOgRxUzL0Ame5cQUGBITGbDI3Rt9EW9cG', '系统管理员', 'ACTIVE', true, '帮你品牌')
ON CONFLICT (username) DO NOTHING; 