// import { FiX } from 'react-icons/fi'

// const ContactPersonForm = ({
//     index,
//     data = {},
//     onChange,
//     onRemove,
//     errors = {}
// }) => {
//     return (
//         <div className="border border-gray-300 rounded-lg p-6 mb-4 bg-gray-50 relative">
//             <button
//                 type="button"
//                 onClick={() => onRemove(index)}
//                 className="absolute top-4 right-4 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
//                 title="Remove Contact Person"
//             >
//                 <FiX className="h-5 w-5" />
//             </button>

//             <h4 className="text-lg font-semibold text-gray-900 mb-4">
//                 Contact Person {index + 1}
//             </h4>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                 {/* Name */}
//                 <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                         Name <span className="text-red-500">*</span>
//                     </label>
//                     <input
//                         type="text"
//                         value={data.name || ''}
//                         onChange={(e) => onChange(index, { ...data, name: e.target.value })}
//                         className="input-field"
//                         placeholder="Enter contact person name"
//                     />
//                     {errors.name && (
//                         <p className="text-red-500 text-xs mt-1">{errors.name}</p>
//                     )}
//                 </div>

//                 {/* Mobile */}
//                 <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                         Mobile Number <span className="text-red-500">*</span>
//                     </label>
//                     <input
//                         type="tel"
//                         value={data.mobile || ''}
//                         onChange={(e) => onChange(index, { ...data, mobile: e.target.value })}
//                         className="input-field"
//                         placeholder="Enter mobile number"
//                         maxLength={10}
//                     />
//                     {errors.mobile && (
//                         <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>
//                     )}
//                 </div>

//                 {/* Email */}
//                 <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                         Email
//                     </label>
//                     <input
//                         type="email"
//                         value={data.email || ''}
//                         onChange={(e) => onChange(index, { ...data, email: e.target.value })}
//                         className="input-field"
//                         placeholder="Enter email address"
//                     />
//                     {errors.email && (
//                         <p className="text-red-500 text-xs mt-1">{errors.email}</p>
//                     )}
//                 </div>

//                 {/* Designation */}
//                 <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                         Designation
//                     </label>
//                     <input
//                         type="text"
//                         value={data.designation || ''}
//                         onChange={(e) => onChange(index, { ...data, designation: e.target.value })}
//                         className="input-field"
//                         placeholder="e.g. Director, Manager"
//                     />
//                 </div>

//                 {/* Gender */}
//                 <div className="md:col-span-2">
//                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                         Gender <span className="text-red-500">*</span>
//                     </label>
//                     <div className="flex space-x-6 mt-2">
//                         {['Male', 'Female', 'Other'].map((gender) => (
//                             <label key={gender} className="inline-flex items-center cursor-pointer">
//                                 <input
//                                     type="radio"
//                                     name={`cp-gender-${index}`}
//                                     value={gender}
//                                     checked={data.gender === gender}
//                                     onChange={(e) => onChange(index, { ...data, gender: e.target.value })}
//                                     className="form-radio h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
//                                 />
//                                 <span className="ml-2 text-sm text-gray-700">{gender}</span>
//                             </label>
//                         ))}
//                     </div>
//                     {errors.gender && (
//                         <p className="text-red-500 text-xs mt-1">{errors.gender}</p>
//                     )}
//                 </div>
//             </div>
//         </div>
//     )
// }

// export default ContactPersonForm



import { useMemo } from 'react'
import { FiX } from 'react-icons/fi'

const ContactPersonForm = ({
  index,              // Only for display
  data = {},
  onChange,
  onRemove,
  errors = {},
  readOnly = false
}) => {

  // Stable identity (NEVER use index)
  const stableKey = useMemo(() => data?.id || data?.localKey, [
    data?.id,
    data?.localKey
  ])

  const handleChange = (patch) => {
    if (readOnly) return
    onChange?.(stableKey, { ...data, ...patch })
  }

  const handleMobileChange = (value) => {
    const clean = value.replace(/\D/g, '').slice(0, 10)
    handleChange({ mobile: clean })
  }

  return (
    <div className="border border-gray-300 rounded-lg p-6 mb-4 bg-gray-50 relative">

      {!readOnly && (
        <button
          type="button"
          onClick={() => onRemove?.(stableKey)}
          className="absolute top-4 right-4 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
          title="Remove Contact Person"
        >
          <FiX className="h-5 w-5" />
        </button>
      )}

      <h4 className="text-lg font-semibold text-gray-900 mb-4">
        Contact Person {typeof index === 'number' ? index + 1 : ''}
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Name <span className="text-red-500">*</span>
          </label>

          <input
            type="text"
            value={data.name || ''}
            onChange={(e) =>
              handleChange({ name: e.target.value.slice(0, 100) })
            }
            className="input-field"
            placeholder="Enter contact person name"
            disabled={readOnly}
          />

          {errors.name && (
            <p className="text-red-500 text-xs mt-1">{errors.name}</p>
          )}
        </div>

        {/* Mobile */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mobile Number <span className="text-red-500">*</span>
          </label>

          <input
            type="tel"
            value={data.mobile || ''}
            onChange={(e) => handleMobileChange(e.target.value)}
            className="input-field"
            placeholder="Enter mobile number"
            maxLength={10}
            disabled={readOnly}
          />

          {errors.mobile && (
            <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>

          <input
            type="email"
            value={data.email || ''}
            onChange={(e) =>
              handleChange({ email: e.target.value.slice(0, 150) })
            }
            className="input-field"
            placeholder="Enter email address"
            disabled={readOnly}
          />

          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email}</p>
          )}
        </div>

        {/* Designation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Designation
          </label>

          <input
            type="text"
            value={data.designation || ''}
            onChange={(e) =>
              handleChange({ designation: e.target.value.slice(0, 100) })
            }
            className="input-field"
            placeholder="e.g. Director, Manager"
            disabled={readOnly}
          />
        </div>

        {/* Gender */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gender <span className="text-red-500">*</span>
          </label>

          <div className="flex space-x-6 mt-2">
            {['Male', 'Female', 'Other'].map((gender) => (
              <label key={gender} className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  name={`cp-gender-${stableKey}`}
                  value={gender}
                  checked={data.gender === gender}
                  onChange={(e) => handleChange({ gender: e.target.value })}
                  className="form-radio h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  disabled={readOnly}
                />
                <span className="ml-2 text-sm text-gray-700">{gender}</span>
              </label>
            ))}
          </div>

          {errors.gender && (
            <p className="text-red-500 text-xs mt-1">{errors.gender}</p>
          )}
        </div>

      </div>
    </div>
  )
}

export default ContactPersonForm
