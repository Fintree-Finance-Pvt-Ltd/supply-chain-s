import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchFlows, createFlow, updateFlow, deleteFlow, toggleFlowStatus, addApprovalStep, removeApprovalStep } from '../../store/slices/approvalSlice'
import { fetchRoles } from '../../store/slices/roleSlice'
import { FiPlus, FiTrash2, FiEdit2, FiCheck, FiX } from 'react-icons/fi'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'

const ApprovalFlowConfig = () => {
  const dispatch = useDispatch()
  const { flows, isLoading } = useSelector((state) => state.approvals)
  const { roles } = useSelector((state) => state.roles)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditFlowModal, setShowEditFlowModal] = useState(false)
  const [showStepModal, setShowStepModal] = useState(false)
  const [selectedFlow, setSelectedFlow] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    flowType: '',
    description: '',
    isSequential: true,
  })
  const [stepFormData, setStepFormData] = useState({
    approverRoleId: '',
    stepOrder: 1,
    stepName: '',
    isRequired: true,
  })

  useEffect(() => {
    dispatch(fetchFlows())
    dispatch(fetchRoles())
  }, [dispatch])

  const handleCreateFlow = async (e) => {
    e.preventDefault()
    try {
      await dispatch(createFlow(formData)).unwrap()
      setShowCreateModal(false)
      setFormData({ name: '', flowType: '', description: '', isSequential: true })
      toast.success('Approval flow created successfully')
    } catch (error) {
      toast.error(error || 'Failed to create approval flow')
    }
  }

  const handleUpdateFlow = async (e) => {
    e.preventDefault()
    try {
      await dispatch(updateFlow({ id: selectedFlow.id, data: { name: formData.name, description: formData.description, isSequential: formData.isSequential } })).unwrap()
      setShowEditFlowModal(false)
      toast.success('Approval flow updated successfully')
    } catch (error) {
      toast.error(error || 'Failed to update approval flow')
    }
  }

  const handleAddStep = async (e) => {
    e.preventDefault()
    try {
      await dispatch(addApprovalStep({ flowId: selectedFlow.id, ...stepFormData })).unwrap()
      setShowStepModal(false)
      setStepFormData({ approverRoleId: '', stepOrder: 1, stepName: '', isRequired: true })
      toast.success('Approval step added successfully')
    } catch (error) {
      toast.error(error || 'Failed to add approval step')
    }
  }

  const handleDeleteStep = async (stepId) => {
    if (window.confirm('Are you sure you want to remove this step?')) {
      try {
        await dispatch(removeApprovalStep(stepId)).unwrap()
        toast.success('Approval step removed successfully')
      } catch (error) {
        toast.error(error || 'Failed to remove approval step')
      }
    }
  }

  const handleDeleteFlow = async (flowId) => {
    if (window.confirm('Are you sure you want to delete this flow?')) {
      try {
        await dispatch(deleteFlow(flowId)).unwrap()
        toast.success('Approval flow deleted successfully')
      } catch (error) {
        toast.error(error || 'Failed to delete approval flow')
      }
    }
  }

  const handleToggleFlowStatus = async (flowId) => {
    try {
      await dispatch(toggleFlowStatus(flowId)).unwrap()
      toast.success('Flow status toggled successfully')
    } catch (error) {
      toast.error(error || 'Failed to toggle flow status')
    }
  }

  const handleEditClick = (flow) => {
    setSelectedFlow(flow)
    setFormData({
      name: flow.name,
      flowType: flow.flowType,
      description: flow.description,
      isSequential: flow.isSequential,
    })
    setShowEditFlowModal(true)
  }

  const handleAddStepClick = (flow) => {
    setSelectedFlow(flow)
    const maxOrder = flow.steps?.length > 0 ? Math.max(...flow.steps.map(s => s.stepOrder)) : 0
    setStepFormData({ approverRoleId: '', stepOrder: maxOrder + 1, stepName: '', isRequired: true })
    setShowStepModal(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Approval Flow Configuration</h1>
          <p className="text-gray-600 mt-2">Configure multi-level approval workflows with sequential steps</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <FiPlus className="h-5 w-5" />
          <span>Create Flow</span>
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {flows.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 text-lg">No approval flows configured yet.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary mt-4 inline-flex items-center space-x-2"
              >
                <FiPlus className="h-5 w-5" />
                <span>Create First Flow</span>
              </button>
            </div>
          ) : (
            flows.map((flow) => (
              <div key={flow.id} className="card">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{flow.name}</h2>
                    <p className="text-sm text-gray-600 mt-1">{flow.description}</p>
                  </div>
                  <div className="space-x-2 flex">
                    <span className="badge badge-primary">{flow.flowType}</span>
                    <span className={flow.isActive ? 'status-active' : 'status-inactive'}>
                      {flow.isActive ? '✓ Active' : '✕ Inactive'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Approval Steps</h3>
                  {flow.steps && flow.steps.length > 0 ? (
                    <div className="space-y-2">
                      {[...flow.steps].sort((a, b) => a.stepOrder - b.stepOrder).map((step, index) => (
                        <div key={step.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                          <div className="flex items-center space-x-3 flex-1">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-600 text-white text-sm font-semibold">
                              {index + 1}
                            </span>
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-gray-900">{step.stepName}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                Role: <span className="font-medium">{step.approverRole?.label || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteStep(step.id)}
                            className="action-button action-button-danger"
                            title="Remove step"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No approval steps configured</p>
                  )}
                  <button
                    onClick={() => handleAddStepClick(flow)}
                    className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 text-sm font-medium mt-2"
                  >
                    <FiPlus className="h-4 w-4" />
                    <span>Add Step</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditClick(flow)}
                    className="btn-primary flex items-center space-x-2 flex-1"
                  >
                    <FiEdit2 className="h-4 w-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleToggleFlowStatus(flow.id)}
                    className={flow.isActive ? 'btn-danger flex items-center space-x-2 flex-1' : 'btn-success flex items-center space-x-2 flex-1'}
                  >
                    {flow.isActive ? <FiX className="h-4 w-4" /> : <FiCheck className="h-4 w-4" />}
                    <span>{flow.isActive ? 'Deactivate' : 'Activate'}</span>
                  </button>
                  <button
                    onClick={() => handleDeleteFlow(flow.id)}
                    className="btn-danger flex items-center space-x-2 flex-1"
                  >
                    <FiTrash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Flow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Create New Approval Flow</h2>
              <form onSubmit={handleCreateFlow} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Credit Sanction Approval"
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Flow Type</label>
                  <input
                    type="text"
                    value={formData.flowType}
                    onChange={(e) => setFormData({ ...formData, flowType: e.target.value })}
                    placeholder="e.g., credit_sanction"
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    rows="3"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isSequential"
                    checked={formData.isSequential}
                    onChange={(e) => setFormData({ ...formData, isSequential: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="isSequential" className="ml-2 text-sm text-gray-700">Sequential Approval</label>
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="submit" className="btn-primary flex-1">Create</button>
                  <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Flow Modal */}
      {showEditFlowModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Edit Approval Flow</h2>
              <form onSubmit={handleUpdateFlow} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    rows="3"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isSequentialEdit"
                    checked={formData.isSequential}
                    onChange={(e) => setFormData({ ...formData, isSequential: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="isSequentialEdit" className="ml-2 text-sm text-gray-700">Sequential Approval</label>
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="submit" className="btn-primary flex-1">Save</button>
                  <button type="button" onClick={() => setShowEditFlowModal(false)} className="btn-secondary flex-1">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Step Modal */}
      {showStepModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Add Approval Step to {selectedFlow?.name}</h2>
              <form onSubmit={handleAddStep} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Approver Role</label>
                  <select
                    value={stepFormData.approverRoleId}
                    onChange={(e) => setStepFormData({ ...stepFormData, approverRoleId: e.target.value })}
                    required
                    className="input-field"
                  >
                    <option value="">Select a role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>{role.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Step Order</label>
                  <input
                    type="number"
                    value={stepFormData.stepOrder}
                    onChange={(e) => setStepFormData({ ...stepFormData, stepOrder: parseInt(e.target.value) })}
                    min="1"
                    required
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Step Name</label>
                  <input
                    type="text"
                    value={stepFormData.stepName}
                    onChange={(e) => setStepFormData({ ...stepFormData, stepName: e.target.value })}
                    placeholder="e.g., Credit Team L1 Review"
                    className="input-field"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isRequired"
                    checked={stepFormData.isRequired}
                    onChange={(e) => setStepFormData({ ...stepFormData, isRequired: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="isRequired" className="ml-2 text-sm text-gray-700">Required Step</label>
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="submit" className="btn-primary flex-1">Add</button>
                  <button type="button" onClick={() => setShowStepModal(false)} className="btn-secondary flex-1">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ApprovalFlowConfig

