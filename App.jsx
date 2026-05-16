import { Routes, Route } from 'react-router-dom'
import MarketingLayout from './layouts/MarketingLayout.jsx'
import DashboardLayout from './layouts/DashboardLayout.jsx'

import Home from './pages/Home.jsx'
import Services from './pages/Services.jsx'
import About from './pages/About.jsx'
import Contact from './pages/Contact.jsx'
import Pricing from './pages/Pricing.jsx'
import Login from './pages/Login.jsx'
import NotFound from './pages/NotFound.jsx'

import DashboardHome from './pages/dashboard/DashboardHome.jsx'
import DashboardProjects from './pages/dashboard/DashboardProjects.jsx'
import DashboardClients from './pages/dashboard/DashboardClients.jsx'
import DashboardInbox from './pages/dashboard/DashboardInbox.jsx'
import DashboardSettings from './pages/dashboard/DashboardSettings.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
      </Route>

      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="projects" element={<DashboardProjects />} />
        <Route path="clients" element={<DashboardClients />} />
        <Route path="inbox" element={<DashboardInbox />} />
        <Route path="settings" element={<DashboardSettings />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
