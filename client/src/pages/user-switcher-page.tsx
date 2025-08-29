import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import UserSwitcher from "@/components/user-switcher";

export default function UserSwitcherPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-64">
        <Header title="ユーザー切り替え（テスト用）" />
        <main className="flex-1 p-6">
          <div className="max-w-md mx-auto">
            <UserSwitcher />
          </div>
        </main>
      </div>
    </div>
  );
}