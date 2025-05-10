const bcrypt = require('bcrypt');

const saltRounds = 10;

/**
 * 对密码进行加密
 * @param {string} password 原始密码
 * @returns {Promise<string>} 加密后的密码
 */
const hashPassword = async (password) => {
  return await bcrypt.hash(password, saltRounds);
};

/**
 * 验证密码是否匹配
 * @param {string} password 原始密码
 * @param {string} hash 加密后的密码
 * @returns {Promise<boolean>} 是否匹配
 */
const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

module.exports = {
  hashPassword,
  comparePassword
};
