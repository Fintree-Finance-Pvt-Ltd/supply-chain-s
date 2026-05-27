// import { useState, useEffect } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { useDispatch, useSelector } from 'react-redux'
// import { fetchCases } from '../../store/slices/caseSlice'
// import DataTable from '../../components/DataTable'
// import StatusBadge from '../../components/StatusBadge'
// import LoadingSpinner from '../../components/LoadingSpinner'
// import { CASE_STATUS, CASE_STATUS_LABELS } from '../../constants/caseStatus'
// import { formatDate } from '../../utils/format'
// import { FiPlus, FiEye } from 'react-icons/fi'

// const RMDashboard = () => {
//   const navigate = useNavigate()
//   const dispatch = useDispatch()
//   const { cases, isLoading } = useSelector((state) => state.cases)
//   const { user } = useSelector((state) => state.auth)
//   const [activeTab, setActiveTab] = useState('all')

//   useEffect(() => {
//     // Pass the logged-in RM's ID to filter only their onboarded customers
//     if (user && user.id) {
//       dispatch(fetchCases({ rmId: user.id }))
//     } else {
//       dispatch(fetchCases())
//     }
//   }, [dispatch, user])

//   const tabs = [
//     { id: 'all', label: 'All Cases' },
//     { id: CASE_STATUS.DRAFT, label: 'Draft' },
//     { id: CASE_STATUS.SUBMITTED, label: 'Submitted' },
//     { id: CASE_STATUS.MD_APPROVED, label: 'Ready for Ops Submit' },
//     { id: CASE_STATUS.OPS_L1_REVIEW, label: 'Ops Review' },
//     { id: CASE_STATUS.COMPLETED, label: 'Completed' },
//     { id: CASE_STATUS.REJECTED, label: 'Rejected' },
//   ]

//   const filteredCases = activeTab === 'all'
//     ? cases
//     : cases.filter(c => c.status === activeTab)

//   const columns = [
//     {
//       key: 'customerCode',
//       label: 'LAN',
//       render: (_, row) => <span className="font-mono text-xs">{row.customerCode || 'Pending'}</span>,
//     },
//     {
//       key: 'name',
//       label: 'Customer Name',
//       render: (_, row) => row.name || row.customerName || row.companyName || 'N/A',
//     },
//     {
//       key: 'mobile',
//       label: 'Mobile',
//       render: (_, row) => row.mobile || row.mobileNumber,
//     },
//     {
//       key: 'pan',
//       label: 'PAN',
//       render: (_, row) => row.pan || row.panNumber,
//     },
//     {
//       key: 'status',
//       label: 'Status',
//       render: (value) => <StatusBadge status={value} label={CASE_STATUS_LABELS[value]} />,
//     },
//     {
//       key: 'createdAt',
//       label: 'Created',
//       render: (value) => formatDate(value),
//     },
//   ]

//   const handleRowClick = (row) => {
//     if (row.status === CASE_STATUS.DRAFT) {
//       navigate(`/rm/customer/new?id=${row.id}`)
//     } else {
//       navigate(`/rm/customer/${row.id}`)
//     }
//   }

//   return (
//     <div className="space-y-6">
//       <div className="flex items-center justify-between">
//         <div>
//           <h1 className="text-3xl font-bold text-gray-900">RM Dashboard</h1>
//           <p className="text-gray-600 mt-2">Manage customer onboarding cases</p>
//         </div>
//         <button
//           onClick={() => navigate('/rm/customer/new')}
//           className="btn-primary flex items-center space-x-2"
//         >
//           <FiPlus className="h-5 w-5" />
//           <span>New Customer</span>
//         </button>
//       </div>

//       <div className="card">
//         <div className="border-b border-gray-200">
//           <nav className="flex space-x-8">
//             {tabs.map((tab) => (
//               <button
//                 key={tab.id}
//                 onClick={() => setActiveTab(tab.id)}
//                 className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
//                   ? 'border-primary-500 text-primary-600'
//                   : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
//                   }`}
//               >
//                 {tab.label}
//               </button>
//             ))}
//           </nav>
//         </div>

//         <div className="mt-6">
//           {isLoading ? (
//             <LoadingSpinner />
//           ) : (
//             <DataTable
//               data={filteredCases}
//               columns={columns}
//               onRowClick={handleRowClick}
//             />
//           )}
//         </div>
//       </div>
//     </div>
//   )
// }

// export default RMDashboard


import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCases, fetchRMDashboard } from '../../store/slices/caseSlice'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { CASE_STATUS, CASE_STATUS_LABELS } from '../../constants/caseStatus'
import { formatDate } from '../../utils/format'
import { FiPlus, FiAlertTriangle, FiClock, FiCheckCircle, FiFileText, FiArrowRight, FiUser } from 'react-icons/fi'

const RMDashboard = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { cases, isLoading } = useSelector((state) => state.cases)
  const { user } = useSelector((state) => state.auth)
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    if (user && user.id) {
      dispatch(fetchRMDashboard())
    } else {
      dispatch(fetchCases())
    }
  }, [dispatch, user])

  const tabs = [
    { id: 'all', label: 'All Cases' },
    { id: CASE_STATUS.DRAFT, label: 'Draft' },
    { id: CASE_STATUS.SUBMITTED, label: 'Submitted' },
    { id: CASE_STATUS.CREDIT_L2_APPROVED, label: 'Ready for MD' },
    { id: CASE_STATUS.MD_APPROVED, label: 'Ready for Ops' },
    { id: CASE_STATUS.OPS_L1_REVIEW, label: 'Ops Review' },
    { id: CASE_STATUS.COMPLETED, label: 'Completed' },
    { id: CASE_STATUS.REJECTED, label: 'Rejected' },
  ]

  const readyForOpsCases = cases.filter(c => c.status === CASE_STATUS.MD_APPROVED)
  const filteredCases = activeTab === 'all' ? cases : cases.filter(c => 
    // c.status === activeTab
    activeTab === 'draft'
          ? ['draft', 'returned_to_rm'].includes(c.status)
          : c.status === activeTab
  )

  const statCards = [
    { label: 'Total Cases', value: cases.length, icon: FiFileText, color: 'slate' },
    { label: 'Ready for Ops', value: readyForOpsCases.length, icon: FiAlertTriangle, color: 'amber', highlight: true },
    { label: 'In Progress', value: cases.filter(c => [CASE_STATUS.SUBMITTED, CASE_STATUS.OPS_L1_REVIEW].includes(c.status)).length, icon: FiClock, color: 'blue' },
    { label: 'Completed', value: cases.filter(c => c.status === CASE_STATUS.COMPLETED).length, icon: FiCheckCircle, color: 'emerald' },
  ]

  const columns = [
    {
      key: 'customerCode',
      label: 'LAN',
      render: (_, row) => (
        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
          {row.customerCode || 'Pending'}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Customer Name',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <FiUser className="w-3.5 h-3.5 text-blue-800" />
          </div>
          <span className="font-medium text-gray-900 text-sm">
            {row.name || row.customerName || row.companyName || 'N/A'}
          </span>
        </div>
      ),
    },
    { key: 'mobile', label: 'Mobile', render: (_, row) => <span className="text-sm text-gray-600">{row.mobile || row.mobileNumber}</span> },
    { key: 'pan', label: 'PAN', render: (_, row) => <span className="font-mono text-xs text-gray-600">{row.pan || row.panNumber}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusBadge status={value} label={CASE_STATUS_LABELS[value]} />,
    },
    { key: 'createdAt', label: 'Created', render: (value) => <span className="text-sm text-gray-500">{formatDate(value)}</span> },
  ]

  const handleRowClick = (row) => {
    if (row.status === CASE_STATUS.DRAFT) {
      navigate(`/rm/customer/new?id=${row.id}`)
    } else {
      navigate(`/rm/customer/${row.id}`)
    }
  }

  
  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .pending-card {
          animation: pulse-ring 2.5s ease-in-out infinite;
        }
        .slide-in { animation: slide-in 0.3s ease-out forwards; }
        .pending-row {
          background: linear-gradient(90deg, #fffbeb 0%, #fef3c7 50%, #fffbeb 100%);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }
        .tab-active {
          position: relative;
        }
        .tab-active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: #1e40af;
          border-radius: 2px 2px 0 0;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">RM Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Manage customer onboarding cases</p>
          </div>
          <button
            onClick={() => navigate('/rm/customer/new')}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shadow-sm"
          >
            <FiPlus className="h-4 w-4" />
            New Customer
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              onClick={() => card.label === 'Ready for Ops' && setActiveTab(CASE_STATUS.MD_APPROVED)}
              className={`relative rounded-xl p-5 border transition-all duration-200 `
            }
            >
              <div className={`inline-flex p-2.5 rounded-lg mb-3 ${
                card.color === 'amber' ? 'bg-amber-100' :
                card.color === 'blue' ? 'bg-blue-100' :
                card.color === 'emerald' ? 'bg-emerald-100' : 'bg-slate-100'
              }`}>
                <card.icon className={`w-5 h-5 ${
                  card.color === 'amber' ? 'text-amber-600' :
                  card.color === 'blue' ? 'text-blue-800' :
                  card.color === 'emerald' ? 'text-emerald-600' : 'text-slate-600'
                }`} />
              </div>
              <div className={`text-3xl font-bold mb-1 ${card.highlight ? 'text-amber-700' : 'text-gray-900'}`}>
                {card.value}
              </div>
              <div className={`text-sm font-medium ${card.highlight ? 'text-amber-600' : 'text-gray-500'}`}>
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="border-b border-gray-200 px-6 overflow-x-auto">
            <nav className="flex space-x-1 -mb-px">
              {tabs.map((tab) => {
                const count = tab.id === 'all' ? cases.length : cases.filter(c => c.status === tab.id).length
                const isPending = tab.id === CASE_STATUS.MD_APPROVED
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative py-4 px-3 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? 'text-blue-800 tab-active'
                        : isPending
                        ? 'text-amber-600 hover:text-amber-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-blue-100 text-blue-800'
                          : isPending
                          ? 'bg-amber-100 text-amber-600 animate-pulse'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="p-6">
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <DataTable
                data={filteredCases}
                columns={columns}
                onRowClick={handleRowClick}
                rowClassName={(row) =>
                  row.status === CASE_STATUS.MD_APPROVED
                    ? 'pending-row border-l-4 border-l-amber-400 hover:bg-amber-50'
                    : 'hover:bg-gray-50'
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RMDashboard

