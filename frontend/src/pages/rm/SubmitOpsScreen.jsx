import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { workflowService } from '../../services/workflowService'
import { customerService } from '../../services/customerService'
import LoadingSpinner from '../../components/LoadingSpinner'

const SubmitOpsScreen = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const [customer, setCustomer] = useState(null)
    const [remarks, setRemarks] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const loadCustomer = async () => {
            try {
                setIsLoading(true)
                const response = await customerService.getCustomerById(id)
                setCustomer(response.data)
            } catch (error) {
                console.error('Error loading customer:', error)
            } finally {
                setIsLoading(false)
            }
        }
        loadCustomer()
    }, [id])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsSubmitting(true)
        try {
            await workflowService.submitToOperations(id, remarks)
            toast.success('Case submitted to Operations Team L1 successfully')
            navigate('/rm/dashboard')
        } catch (error) {
            toast.error('Failed to submit: ' + (error.response?.data?.message || error.message))
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) return <LoadingSpinner />
    if (!customer) return <div>Customer not found</div>

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <button
                    onClick={() => navigate('/rm/dashboard')}
                    className="text-primary-600 hover:text-primary-700 mb-4"
                >
                    ← Back to Dashboard
                </button>
                <h1 className="text-3xl font-bold text-gray-900">Submit to Operations</h1>
                <p className="text-gray-600 mt-2">The case has been approved by MD. Please submit to Operations for final verification.</p>
            </div>

            <div className="card space-y-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Case Details</h2>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                        <p className="text-gray-600">Customer Name:</p>
                        <p className="font-medium text-gray-900">{customer.customerName}</p>
                        <p className="text-gray-600">Customer Code:</p>
                        <p className="font-medium text-gray-900">{customer.customerCode}</p>
                        <p className="text-gray-600">LAN ID:</p>
                        <p className="font-medium text-indigo-600">{customer.lanId || 'PENDING'}</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Submission Remarks
                        </label>
                        <textarea
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="input-field"
                            rows={4}
                            placeholder="Add any instructions for the operations team..."
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full btn-primary py-3"
                    >
                        {isSubmitting ? <LoadingSpinner size="sm" /> : 'Submit to Operations L1'}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default SubmitOpsScreen
