import request from './request'
import { SILENT_ERROR } from '@/utils/requestOptions'

// 登录
export const login = (data) => {
  return request({
    url: '/auth/login',
    method: 'post',
    data
  })
}

// 登出
export const logout = () => {
  return request({
    url: '/auth/logout',
    method: 'post'
  })
}

// 获取用户信息
export const getUserInfo = () => {
  return request({
    url: '/auth/user',
    method: 'get'
  })
}

/** 任意已登录用户：空闲自动登出分钟数 */
export const getSessionPolicy = (config = {}) => {
  return request.get('/auth/session-policy', { ...SILENT_ERROR, ...config })
}

export const updateProfile = (data) => {
  return request({
    url: '/auth/profile',
    method: 'patch',
    data
  })
}

export const changePassword = (data) => {
  return request({
    url: '/auth/password',
    method: 'patch',
    data
  })
}
