import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AvatarProfile, PetPreview } from './AvatarProfile'
import { renderAssets } from './catalog'

const puzzle = {
  id: 'puzzle-1',
  name: 'Вокруг света',
  totalFragments: 12,
  collectedFragments: 8,
  rewardClothingId: 'cloud-scarf',
  rewardName: 'Облачный шарфик',
  completed: false,
}
const puzzles = [
  puzzle,
  { id: 'puzzle-2', name: 'Космическая экспедиция', totalFragments: 8, collectedFragments: 0, rewardClothingId: 'space-hat', rewardName: 'Космическая шапка', completed: false },
  { id: 'puzzle-3', name: 'Небесное путешествие', totalFragments: 6, collectedFragments: 0, rewardClothingId: 'traveler-costume', rewardName: 'Костюм путешественника', completed: false },
]
const onSave = vi.fn()
const onClose = vi.fn()
const onToggleSound = vi.fn()
const props = {
  userId: 'anna',
  userName: 'Анна',
  balance: 5000,
  favoriteTheme: 'red' as const,
  gamesPlayed: 86,
  score: 100,
  wins: 31,
  petName: 'Пушок',
  puzzle,
  puzzles,
  unlockedClothingIds: ['aviator', 'sunhat', 'bow'],
  equippedClothing: { headId: 'aviator', neckId: 'bow' },
  onFortunePrize: vi.fn(),
  soundOn: true,
  onToggleSound,
  onUnlockAudio: vi.fn(),
  onSave,
  onClose,
}

const openWardrobe = () => fireEvent.click(screen.getByRole('button', { name: 'Открыть гардероб' }))

describe('profile wardrobe', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  })
  beforeEach(() => {
    onSave.mockClear()
    onClose.mockClear()
    onToggleSound.mockClear()
    props.onFortunePrize.mockClear()
    window.localStorage.clear()
  })

  it('shows real puzzle progress and its clothing reward', () => {
    render(<AvatarProfile {...props} />)
    expect(screen.getByText('🧩 8 / 12')).toBeInTheDocument()
    expect(screen.getByText('🎁 Награда: Облачный шарфик')).toBeInTheDocument()
  })

  it('keeps the profile icon on the profile page', () => {
    render(<AvatarProfile {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Профиль' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('opens the logout menu from the profile icon and closes it outside', () => {
    const onLogout = vi.fn()
    render(<AvatarProfile {...props} onLogout={onLogout} />)
    fireEvent.click(screen.getByRole('button', { name: 'Профиль' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Профиль' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Выйти' }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('uses the shared top menu to toggle sound', () => {
    render(<AvatarProfile {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Выключить звук' }))
    expect(onToggleSound).toHaveBeenCalledTimes(1)
  })

  it('shows a locked item but cannot equip it', () => {
    render(<AvatarProfile {...props} />)
    openWardrobe()
    fireEvent.click(screen.getByRole('button', { name: 'Шея' }))
    fireEvent.click(screen.getByRole('button', { name: 'Облачный шарфик, заблокировано' }))
    expect(screen.getByRole('button', { name: /Закрыто/ })).toBeDisabled()
    expect(screen.getByRole('img', { name: /Пушок: Авиатор, Красная бабочка/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить образ' }))
    expect(onSave).toHaveBeenCalledWith('Пушок', { headId: 'aviator', neckId: 'bow' })
  })

  it('equips and saves an unlocked puzzle item through the store callback', () => {
    render(<AvatarProfile {...props} unlockedClothingIds={[...props.unlockedClothingIds, 'cloud-scarf']} />)
    openWardrobe()
    fireEvent.click(screen.getByRole('button', { name: 'Шея' }))
    fireEvent.click(screen.getByRole('button', { name: 'Облачный шарфик' }))
    fireEvent.click(screen.getByRole('button', { name: 'Надеть' }))
    expect(screen.getByRole('img', { name: /Пушок: Авиатор, Облачный шарфик/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить образ' }))
    expect(onSave).toHaveBeenCalledWith('Пушок', { headId: 'aviator', neckId: 'cloud-scarf' })
  })

  it('renders a single pre-composed image for every supported outfit', () => {
    for (const head of ['aviator', 'sunhat']) {
      for (const neck of ['bow', 'cloud-scarf']) {
        const { container, unmount } = render(<PetPreview outfit={{ name: 'Пушок', head, neck }} />)
        expect(container.querySelectorAll('img')).toHaveLength(1)
        expect(container.querySelector('img')).toHaveAttribute('src', renderAssets[`${head}:${neck}` as keyof typeof renderAssets])
        unmount()
      }
    }
  })

  it('asks before discarding unsaved changes', () => {
    render(<AvatarProfile {...props} />)
    openWardrobe()
    fireEvent.click(screen.getByRole('button', { name: 'Соломенная шляпа' }))
    fireEvent.click(screen.getByRole('button', { name: 'Надеть' }))
    fireEvent.click(screen.getByRole('button', { name: /Назад/ }))
    const confirmation = screen.getByRole('alertdialog')
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Выйти без сохранения' }))
    expect(screen.queryByRole('heading', { name: 'Мой профиль' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'История игр' })).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('opens the fortune wheel and applies the sector reached by the animation', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(.999)
    const { container } = render(<AvatarProfile {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Крутить колесо' }))
    expect(screen.getByRole('dialog', { name: 'Колесо фортуны' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Крутить' }))
    expect(screen.getByRole('button', { name: 'Колесо вращается…' })).toBeDisabled()

    fireEvent.transitionEnd(container.querySelector('.fortune-wheel-rotor')!, { propertyName: 'transform' })
    expect(props.onFortunePrize).toHaveBeenCalledWith(expect.objectContaining({ type: 'puzzle', amount: 1 }))
    expect(screen.getByText('Фрагмент пазла добавлен в коллекцию!')).toBeInTheDocument()

    random.mockRestore()
  })

  it('opens the full puzzle collection from the profile preview', () => {
    render(<AvatarProfile {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Вся коллекция/ }))
    const collection = screen.getByRole('dialog', { name: 'Коллекция пазлов' })
    expect(within(collection).getByRole('heading', { name: 'Вокруг света' })).toBeInTheDocument()
    expect(within(collection).getByRole('heading', { name: 'Космическая экспедиция' })).toBeInTheDocument()
    expect(within(collection).getByRole('heading', { name: 'Небесное путешествие' })).toBeInTheDocument()
    expect(within(collection).getByText('8 / 12 фрагментов')).toBeInTheDocument()
  })
})
