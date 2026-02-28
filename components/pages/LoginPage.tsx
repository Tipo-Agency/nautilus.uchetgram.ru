/**
 * LoginPage — демо: один вход по кнопке «Вход»
 */
import React from 'react';
import { User } from '../../types';
import { AuthLayout } from '../layouts/AuthLayout';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { LogIn } from 'lucide-react';
import { LOGIN_TITLE, LOGIN_SUBTITLE } from '../../constants';
import { Logo } from '../Logo';

interface LoginPageProps {
  users: User[];
  onLogin: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ users, onLogin }) => {
  const handleEnter = () => {
    const user = users[0];
    if (user) onLogin(user);
  };

  return (
    <AuthLayout>
      <Card className="w-full p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Logo className="h-14 w-auto max-w-[200px]" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{LOGIN_TITLE}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{LOGIN_SUBTITLE}</p>
        </div>

        <Button
          type="button"
          variant="primary"
          fullWidth
          icon={LogIn}
          className="mt-6"
          onClick={handleEnter}
          disabled={!users.length}
        >
          Вход
        </Button>
      </Card>
    </AuthLayout>
  );
};
