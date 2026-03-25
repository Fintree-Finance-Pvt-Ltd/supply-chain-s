import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { customerService } from '../../services/customerService'
import LoadingSpinner from '../../components/LoadingSpinner'
import ApprovalTimeline from '../../components/ApprovalTimeline'
import { formatDate } from '../../utils/format'
import { FiFileText, FiDownload, FiCheckCircle, FiInfo } from 'react-icons/fi'

const CaseAuditDetail = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const [customer, setCustomer] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true)
                const response = await customerService.getCustomerById(id)
                setCustomer(response.data)
            } catch (error) {
                console.error('Error loading audit data:', error)
            } finally {
                setIsLoading(false)
            }
        }
        loadData()
    }, [id])

    if (isLoading) return <LoadingSpinner />
    if (!customer) return <div className="p-10 text-center">Case not found</div>

    const formattedApprovals = (customer.statusHistory || []).map(action => ({
        approverName: action.changedByUser?.name || 'System',
        approverRole: action.changedByUser?.defaultRole?.toUpperCase() || 'SYSTEM',
        status: action.status,
        approvedAt: action.createdAt,
        comments: action.remarks,
    }))

    return (
        <div className="space-y-6 max-w-7xl mx-auto py-6 px-4">
            <div className="flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="text-primary-600 hover:underline">← Back</button>
                <h1 className="text-2xl font-bold">Audit View: {customer.customerName}</h1>
                <span className={`px-4 py-1 rounded-full text-white font-bold bg-indigo-600`}>
                    {customer.status?.toUpperCase()}
                </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">

                    {/* Customer Metadata */}
                    <div className="card">
                        <h2 className="text-lg font-bold mb-4 flex items-center"><FiInfo className="mr-2" /> General Information</h2>
                        <div className="grid grid-cols-2 gap-y-4 text-sm">
                            <div><p className="text-gray-500">Full Name</p><p className="font-medium">{customer.customerName}</p></div>
                            <div><p className="text-gray-500">Contact</p><p className="font-medium">{customer.contactNumber}</p></div>
                            <div><p className="text-gray-500">PAN</p><p className="font-medium">{customer.panNumber}</p></div>
                            <div><p className="text-gray-500">LAN ID</p><p className="font-medium text-indigo-600">{customer.lanId || 'PENDING'}</p></div>
                        </div>
                    </div>

                    {/* Documents Audit */}
                    <div className="card">
                        <h2 className="text-lg font-bold mb-4">Document Verification Audit</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-3">Document</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Verified By</th>
                                        <th className="p-3">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {customer.documents?.map(doc => (
                                        <tr key={doc.id}>
                                            <td className="p-3 font-medium">{doc.fileName}</td>
                                            <td className="p-3 uppercase">{doc.documentType}</td>
                                            <td className="p-3">
                                                {doc.status === 'approved' ? <FiCheckCircle className="text-green-500" /> : <span className="text-red-500">Reject</span>}
                                            </td>
                                            <td className="p-3 text-xs">{doc.verifiedByUser?.name || 'N/A'}</td>
                                            <td className="p-3 text-xs italic">{doc.remarks || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Sanction History */}
                    <div className="card">
                        <h2 className="text-lg font-bold mb-4">Sanction Limit History</h2>
                        <div className="space-y-3">
                            {customer.creditSanctions && customer.creditSanctions.length > 0 ? (
                                <div className="space-y-3">
                                    {customer.creditSanctions.map((sanction, index) => (
                                        <div key={sanction.id} className="p-4 bg-indigo-50 rounded border border-indigo-100">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-sm font-bold text-indigo-700">
                                                    {sanction.partner || `Partner ${index + 1}`}
                                                </h3>
                                                <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-1 rounded-full">
                                                    {sanction.status || 'N/A'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div><p className="text-xs text-indigo-600 font-bold">AMOUNT</p><p className="text-xl font-bold">₹{sanction.sanctionAmount}</p></div>
                                                <div><p className="text-xs text-indigo-600 font-bold">TENURE</p><p className="text-xl font-bold">{sanction.tenure} M</p></div>
                                                <div><p className="text-xs text-indigo-600 font-bold">RATE</p><p className="text-xl font-bold">{sanction.interestRate}%</p></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-gray-400">No sanction data available</p>}

                            {/* Normally we'd fetch SanctionLimitHistory entity data here */}
                            <p className="text-xs text-gray-400 mt-4 italic">* Detailed audit trail includes all manual revisals by CEO/MD.</p>
                        </div>
                    </div>

                </div>

                <div className="space-y-6">
                    <div className="card">
                        <h2 className="text-lg font-bold mb-4">Workflow Timeline</h2>
                        <ApprovalTimeline approvals={formattedApprovals} />
                    </div>

                    <div className="card">
                        <h2 className="text-lg font-bold mb-2">Final Status</h2>
                        <div className="p-6 text-center border-2 border-dashed rounded-lg">
                            <p className="text-sm text-gray-500 mb-1 font-bold">State</p>
                            <p className="text-2xl font-black text-indigo-700">{customer.status?.toUpperCase()}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CaseAuditDetail
