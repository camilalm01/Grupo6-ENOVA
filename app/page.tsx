import { redirect } from 'next/navigation';

// Redirect the root path to /login. This is a server-side redirect so opening
// http://localhost:3000/ will immediately send the user to /login.
export default function Page() {
  redirect('/login');
}
