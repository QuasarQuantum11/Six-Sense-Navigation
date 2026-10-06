import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-6 py-12 text-slate-900">
      <h1 className="text-3xl font-bold">Privacy and your data</h1>
      <h2 className="text-xl font-semibold">Optional location</h2>
      <p>Guests and students can choose to enable browser location on the map. Your browser asks for permission. Updates remain in memory while the map is open. We do not store location history or associate location updates with your account. Stop location at any time, or revoke permission in your browser. Leaving the map or hiding the page stops tracking.</p>
      <p>Using your location as a start copies that position into the route planner. It remains a chosen start until replaced or the map is closed. Moving does not automatically send updates or recalculate a route. When you calculate a route, its start and destination are sent to our routing services. The app sends coordinates in request bodies, and route responses are not cached. Hosting providers may retain operational logs according to their own policies.</p>
      <p>The map loads tiles from OpenStreetMap. Tile requests share your IP address, the area of map you view and this website&apos;s origin with that provider. Our referrer policy excludes page paths and query parameters from these cross-origin requests. Your browser or device may also use a location provider to determine your position. Browser location is approximate and cannot identify an indoor floor or room.</p>
      <h2 className="text-xl font-semibold">Accounts, timetables and feedback</h2>
      <p>We store your account details, navigation preferences, saved timetable classes and submitted feedback to provide these features. Passwords are stored as salted hashes. An HttpOnly session cookie keeps you signed in for up to seven days; signing out removes it from your browser.</p>
      <p>You can access and change your own profile, timetable and feedback. Other students cannot access your records. Authorised administrators can view student records, timetables and feedback for system management. You can delete saved timetables and your feedback from their pages.</p>
      <p>Account and timetable data remain stored until removed; automatic expiry and self-service account deletion are not available. Timetable fields are not separately encrypted by the application. Production connections require HTTPS; database encryption and retention depend on the configured hosting service.</p>
      <Link href="/map" className="inline-block font-medium text-blue-800 underline">Return to map</Link>
    </main>
  );
}
