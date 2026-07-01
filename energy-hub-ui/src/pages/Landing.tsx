import { Link } from "react-router-dom";
import { Zap, Shield, User } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header Section */}
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center justify-center p-4 bg-emerald-100 rounded-full mb-6 shadow-sm">
            <Zap className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">
            Welcome to eMeter
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            The smart electricity management system. Please select your portal to securely access your dashboard and data.
          </p>
        </div>

        {/* Portals Section */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-10">
          {/* Consumer Portal Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 hover:shadow-lg hover:border-blue-200 transition-all duration-300 group flex flex-col relative overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500" />
            <div className="relative z-10">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <User className="h-7 w-7 text-blue-600" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-3">Consumer Portal</h2>
              <p className="text-slate-600 mb-8 flex-grow">
                Are you a resident or consumer? Log in here to view your electricity bills, check your current usage, and download your billing history.
              </p>
              <Link 
                to="/consumer/login" 
                className="inline-flex items-center justify-center w-full bg-blue-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow active:scale-[0.98]"
              >
                Access Consumer Portal
              </Link>
            </div>
          </div>

          {/* Admin Portal Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 hover:shadow-lg hover:border-emerald-200 transition-all duration-300 group flex flex-col relative overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500" />
            <div className="relative z-10">
              <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mb-6">
                <Shield className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-3">Staff / Admin Portal</h2>
              <p className="text-slate-600 mb-8 flex-grow">
                For administrators and meter readers. Log in to manage consumers, input meter readings, generate bills, and view system reports.
              </p>
              <Link 
                to="/login" 
                className="inline-flex items-center justify-center w-full bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm hover:shadow active:scale-[0.98]"
              >
                Access Staff Portal
              </Link>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center mt-12 text-sm text-slate-500 animate-in fade-in duration-1000 delay-300">
          &copy; {new Date().getFullYear()} eMeter Electricity Management System. All rights reserved.
        </div>
      </div>
    </div>
  );
}
