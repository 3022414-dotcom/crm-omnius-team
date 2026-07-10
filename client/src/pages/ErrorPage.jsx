import { useRouteError, Link } from 'react-router-dom'

const ERROR_MESSAGES = {
  404: { title: 'Страница не найдена', description: 'Запрошенная страница не существует.' },
  403: { title: 'Нет доступа', description: 'У вас нет прав для просмотра этой страницы.' },
  500: { title: 'Что-то пошло не так', description: 'Произошла ошибка сервера. Попробуйте позже.' },
}

export default function ErrorPage() {
  const error = useRouteError()
  const status = error?.status ?? 500
  const { title, description } = ERROR_MESSAGES[status] ?? ERROR_MESSAGES[500]

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <p className="text-6xl font-bold text-primary">{status}</p>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Link to="/" className="inline-block mt-4 px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary-dark transition-colors">
          На главную
        </Link>
      </div>
    </div>
  )
}
