<template>
  <Teleport to="body">
  <div v-if="visible" class="status-modal-overlay" @click.self="store.hide()">
    <div class="status-modal-wrapper">
      <div class="status-modal-header">
        <span class="status-modal-title">Reminder</span>
        <button type="button" class="status-modal-close" @click="store.hide()">
          <svg viewBox="0 0 24 24" class="status-close-icon">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
      <div class="status-modal-body">
        <p :class="['status-dialog-message', type]">{{ message }}</p>
      </div>
      <div class="status-modal-footer">
        <el-button class="status-confirm-btn" type="default" @click="store.hide()">OK</el-button>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { storeToRefs } from 'pinia'
import { useStatusDialogStore } from '@/stores/statusDialog'

const store = useStatusDialogStore()
const { visible, message, type } = storeToRefs(store)
</script>

<style scoped>
.status-modal-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 13000;
  padding: 20px;
}

.status-modal-wrapper {
  width: min(92vw, 420px);
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.status-modal-header {
  background: #00723a;
  color: #ffffff;
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-modal-title {
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.5;
}

.status-modal-close {
  background: none;
  border: none;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.status-close-icon {
  width: 20px;
  height: 20px;
  stroke: #ffffff;
  fill: none;
}

.status-modal-close:hover .status-close-icon {
  stroke: #d1fae5;
}

.status-modal-body {
  padding: 1.25rem 1.5rem 1rem;
}

.status-modal-footer {
  padding: 0.9rem 1.25rem 1.1rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
}

.status-confirm-btn {
  background-color: #00723a;
  border-color: #00723a;
  color: #ffffff;
  font-weight: 600;
  min-width: 88px;
}

.status-confirm-btn:hover {
  background-color: #005a2e;
  border-color: #005a2e;
  color: #ffffff;
}

.status-dialog-message {
  margin: 0;
  font-size: 0.9rem;
  text-align: center;
  line-height: 1.55;
  color: #333333;
}

.status-dialog-message.warning {
  color: #e6a23c;
}

.status-dialog-message.error {
  color: #f56c6c;
}
</style>
