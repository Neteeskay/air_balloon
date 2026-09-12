import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AvatarProfile, PetPreview } from './AvatarProfile'
import { defaultOutfit, outfitKey, readOutfit, items, renderAssets } from './catalog'

const props = { scope: 'mock:anna', userName: 'Анна', balance: 5000, score: 100, onClose: vi.fn() }
const editor = () => fireEvent.click(screen.getByRole('button', { name: 'Настроить образ' }))
describe('profile wardrobe', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  })
  beforeEach(() => localStorage.clear())
  it('opens from profile, previews a full combination and saves per user', () => {
    const { unmount } = render(<AvatarProfile {...props} />)
    editor()
    fireEvent.click(screen.getByRole('button', { name: 'Соломенная шляпа' }))
    fireEvent.click(screen.getByRole('button', { name: 'Шея' }))
    fireEvent.click(screen.getByRole('button', { name: 'Облачный шарфик' }))
    expect(screen.getByRole('button', { name: /Одежда/ })).toBeDisabled()
    expect(screen.getByRole('img', { name: /Пушок: Соломенная шляпа, Облачный шарфик/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Изменить имя питомца' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Имя питомца' }), { target: { value: 'Облачко' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить образ' }))
    expect(screen.getByRole('status')).toHaveTextContent('Образ сохранён')
    expect(readOutfit(props.scope)).toEqual({ name: 'Облачко', head: 'sunhat', neck: 'cloud-scarf', clothes: null })
    expect(readOutfit('mock:maks')).toEqual(defaultOutfit)
    unmount(); render(<AvatarProfile {...props} />); editor()
    expect(screen.getByRole('img', { name: /Облачко: Соломенная шляпа/ })).toBeInTheDocument()
  })
  it('offers only two head and two neck choices and blocks clothing', () => {
    render(<AvatarProfile {...props} />); editor()
    expect(items.filter(item => item.category === 'head')).toHaveLength(2)
    expect(items.filter(item => item.category === 'neck')).toHaveLength(2)
    expect(items.filter(item => item.category === 'clothes')).toHaveLength(0)
    const clothing = screen.getByRole('button', { name: /Одежда/ })
    expect(clothing).toBeDisabled()
    expect(clothing).toHaveTextContent('Скоро появится')
    fireEvent.click(clothing)
    expect(screen.getByRole('heading', { name: 'Головные уборы' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Снять' })).not.toBeInTheDocument()
  })
  it('renders one unique full PNG per pair, with no overlay or sprite-sheet fallback', () => {
    for (const head of ['aviator', 'sunhat'] as const) {
      for (const neck of ['bow', 'cloud-scarf'] as const) {
        const { container, unmount } = render(<PetPreview outfit={{name: 'Пушок', head, neck, clothes: null}} />)
        expect(container.querySelectorAll('img')).toHaveLength(1)
        expect(container.querySelector('img')).toHaveAttribute('src', renderAssets[`${head}:${neck}`])
        expect(container.querySelector('svg')).toBeNull()
        expect(container.querySelector('.av-pet-layer')).toBeNull()
        unmount()
      }
    }
    expect(new Set(Object.values(renderAssets)).size).toBe(4)
  })
  it('migrates old clothing and removed items without losing the pet name', () => {
    localStorage.setItem(outfitKey(props.scope), JSON.stringify({ name: 'Облачко', head: 'cap', neck: 'bandana', clothes: 'hoodie' }))
    expect(readOutfit(props.scope)).toEqual({ ...defaultOutfit, name: 'Облачко' })
    localStorage.setItem(outfitKey(props.scope), JSON.stringify({ name: 'Облачко', head: null, neck: null, clothes: 'vest' }))
    expect(readOutfit(props.scope)).toEqual({ ...defaultOutfit, name: 'Облачко' })
  })
  it('shows an error for a missing render instead of pasting accessories', () => {
    const { container } = render(<PetPreview outfit={defaultOutfit} />)
    fireEvent.error(container.querySelector('img')!)
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить образ')
    expect(container.querySelector('svg')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(container.querySelector('img')).toBeInTheDocument()
  })
  it('discards unsaved changes on Back only after confirmation', () => {
    render(<AvatarProfile {...props} />); editor()
    fireEvent.click(screen.getByRole('button', { name: 'Соломенная шляпа' }))
    fireEvent.click(screen.getByRole('button', { name: /Назад/ }))
    const confirmation = screen.getByRole('alertdialog')
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Выйти без сохранения' }))
    editor()
    expect(screen.getByRole('img', { name: /Пушок: Авиатор/ })).toBeInTheDocument()
    expect(localStorage.getItem(outfitKey(props.scope))).toBeNull()
  })
  it('keeps the draft and reports unavailable storage instead of claiming a save', () => {
    render(<AvatarProfile {...props} />); editor()
    const fail = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить образ' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось сохранить')
    expect(screen.getByRole('heading', { name: 'Настройка образа' })).toBeInTheDocument()
    fail.mockRestore()
  })
  it('rejects persisted locked items and malformed storage', () => {
    localStorage.setItem(outfitKey(props.scope), JSON.stringify({ name: 'Пушок', head: 'tophat', neck: 'cap', clothes: null }))
    expect(readOutfit(props.scope)).toEqual(defaultOutfit)
    localStorage.setItem(outfitKey(props.scope), '{broken')
    expect(readOutfit(props.scope)).toEqual(defaultOutfit)
  })
})
