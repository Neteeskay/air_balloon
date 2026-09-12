import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AvatarProfile, PetPreview } from './AvatarProfile'
import { renderAssets } from './catalog'

const puzzle = {
  id: 'sky-journey',
  name: 'Небесное путешествие',
  totalFragments: 6,
  collectedFragments: 5,
  rewardClothingId: 'cloud-scarf',
  completed: false,
}
const onSave = vi.fn()
const props = {
  userName: 'Анна',
  balance: 5000,
  score: 100,
  petName: 'Пушок',
  puzzle,
  unlockedClothingIds: ['aviator', 'sunhat', 'bow'],
  equippedClothing: { headId: 'aviator', neckId: 'bow' },
  onSave,
  onClose: vi.fn(),
}

const openWardrobe = () => fireEvent.click(screen.getByRole('button', { name: 'Открыть гардероб' }))

describe('profile wardrobe', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  })
  beforeEach(() => onSave.mockClear())

  it('shows real puzzle progress and its clothing reward', () => {
    render(<AvatarProfile {...props} />)
    expect(screen.getByText('5 / 6 фрагментов')).toBeInTheDocument()
    expect(screen.getByText('Награда: Облачный шарфик')).toBeInTheDocument()
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
    expect(screen.getByRole('heading', { name: 'Мой профиль' })).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})
