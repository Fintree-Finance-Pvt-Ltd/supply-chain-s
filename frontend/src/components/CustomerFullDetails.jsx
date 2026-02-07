import React from 'react'

const CustomerFullDetails = ({ customer }) => {
    if (!customer) return null

    return (
        <div className="space-y-6">
            {/* Basic Information */}
            <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <p className="text-sm text-gray-600">Company Type</p>
                        <p className="font-medium">{customer.companyType || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Company Name</p>
                        <p className="font-medium">{customer.companyName || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Customer Name</p>
                        <p className="font-medium">{customer.name || customer.customerName || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Mobile Number</p>
                        <p className="font-medium">{customer.mobile || customer.mobileNumber || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="font-medium">{customer.email || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">PAN Number</p>
                        <p className="font-medium">{customer.pan || customer.panNumber || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">GST Number</p>
                        <p className="font-medium">{customer.gstNumber || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Aadhaar Number</p>
                        <p className="font-medium">{customer.aadhaar || customer.aadhaarNumber || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Electricity Bill</p>
                        <p className="font-medium">{customer.electricityBillNo || customer.electricityBillNumber || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">RM Name</p>
                        <p className="font-medium">{customer.rm?.name || customer.rmName || 'N/A'}</p>
                    </div>
                    {/* Add Customer Code / LAN */}
                    <div>
                        <p className="text-sm text-gray-600">Customer Code (LAN)</p>
                        <p className="font-medium">{customer.customerCode || 'Pending'}</p>
                    </div>
                </div>
            </div>

            {/* Address Details */}
            {customer.addresses && customer.addresses.length > 0 && (
                <div className="card">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Address Details</h2>
                    <div className="space-y-4">
                        {customer.addresses.map((addr, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded border border-gray-200">
                                <p className="text-xs text-gray-500 uppercase font-bold mb-1">{addr.type} Address</p>
                                <p className="text-sm font-medium">{addr.fullAddress}</p>
                                <p className="text-sm text-gray-600">{addr.city}, {addr.state} - {addr.pincode}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Co-Applicants */}
            {customer.coApplicants && customer.coApplicants.length > 0 && (
                <div className="card">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Co-Applicants</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customer.coApplicants.map((coApp, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded border border-gray-200">
                                <p className="font-medium text-gray-900">{coApp.name}</p>
                                <p className="text-sm text-gray-600">Mobile: {coApp.mobile}</p>
                                <p className="text-sm text-gray-600">Email: {coApp.email || 'N/A'}</p>
                                <p className="text-sm text-gray-600">Gender: {coApp.gender}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Contact Persons */}
            {customer.contactPersons && customer.contactPersons.length > 0 && (
                <div className="card">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Persons</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customer.contactPersons.map((cp, index) => (
                            <div key={index} className="p-3 bg-gray-50 rounded border border-gray-200">
                                <p className="font-medium text-gray-900">{cp.name}</p>
                                <p className="text-sm text-gray-600">{cp.designation}</p>
                                <p className="text-sm text-gray-600">Mobile: {cp.mobile}</p>
                                <p className="text-sm text-gray-600">Email: {cp.email || 'N/A'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default CustomerFullDetails
