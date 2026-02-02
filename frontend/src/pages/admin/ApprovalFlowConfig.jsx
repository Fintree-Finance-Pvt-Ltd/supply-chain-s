import { useState, useEffect } from 'react'
import { FiPlus, FiTrash2 } from 'react-icons/fi'
import { ROLES, ROLE_LABELS } from '../../constants/roles'
import { approvalService } from '../../services/approvalService'
import { toast } from 'react-hot-toast'

const ApprovalFlowConfig = () => {
  const [flows, setFlows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchFlows()
  }, [])

  const fetchFlows = async () => {
    try {
      setLoading(true)
      const response = await approvalService.getFlows()
      // Transform backend data to frontend format if needed, or use as is
      // Backend returns: { id, name, flowType, steps: [{ id, stepOrder, approverRoleId, stepName }] }
      // Frontend expects: { id, name, type, steps: [{ id, role, order }] }

      const formattedFlows = response.data.map(flow => ({
        id: flow.id,
        name: flow.name,
        type: flow.flowType,
        steps: flow.steps.map(step => ({
          id: step.id || Date.now() + Math.random(), // Ensure unique ID for UI keys
          role: step.approverRole?.name || step.approverRoleId, // Use role name if available, else ID
          order: step.stepOrder,
          name: step.stepName
        })).sort((a, b) => a.order - b.order)
      }))

      setFlows(formattedFlows)
      setError(null)
    } catch (err) {
      console.error('Error loading flows:', err)
      setError('Failed to load approval flows')
    } finally {
      setLoading(false)
    }
  }

  const addStep = (flowId) => {
    setFlows(flows.map(flow =>
      flow.id === flowId
        ? { ...flow, steps: [...flow.steps, { id: Date.now(), role: '', order: flow.steps.length + 1 }] }
        : flow
    ))
  }

  const removeStep = (flowId, stepId) => {
    setFlows(flows.map(flow =>
      flow.id === flowId
        ? { ...flow, steps: flow.steps.filter(s => s.id !== stepId) }
        : flow
    ))
  }

  const updateStepRole = (flowId, stepId, role) => {
    setFlows(flows.map(flow =>
      flow.id === flowId
        ? { ...flow, steps: flow.steps.map(s => s.id === stepId ? { ...s, role } : s) }
        : flow
    ))
  }

  const handleSave = async (flow) => {
    try {
      setSaving(true)
      // Format payload for backend
      // Backend expects: steps: [{ roleId, order, name }]
      const steps = flow.steps.map((step, index) => ({
        roleId: step.role,
        order: index + 1,
        name: step.name || `Step ${index + 1}`
      }))

      await approvalService.updateFlow(flow.type, steps)
      toast.success(`${flow.name} updated successfully`)
      fetchFlows() // Refresh to get latest IDs etc
    } catch (err) {
      console.error('Error saving flow:', err)
      toast.error(err.message || 'Failed to update approval flow')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Approval Flow Configuration</h1>
        <p className="text-gray-600 mt-2">Configure multi-level approval workflows</p>
      </div>

      <div className="space-y-6">
        {flows.map((flow) => (
          <div key={flow.id} className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">{flow.name}</h2>
              <span className="badge bg-blue-100 text-blue-800">{flow.type}</span>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Approval Steps (Sequential)</h3>
              {flow.steps.map((step, index) => (
                <div key={step.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-600 w-8">
                    {index + 1}.
                  </span>
                  <select
                    value={step.role}
                    onChange={(e) => updateStepRole(flow.id, step.id, e.target.value)}
                    className="flex-1 input-field"
                  >
                    <option value="">Select role</option>
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeStep(flow.id, step.id)}
                    className="p-2 text-red-600 hover:text-red-700"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addStep(flow.id)}
                className="flex items-center space-x-2 text-primary-600 hover:text-primary-700"
              >
                <FiPlus className="h-4 w-4" />
                <span className="text-sm font-medium">Add Step</span>
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={() => handleSave(flow)}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ApprovalFlowConfig

