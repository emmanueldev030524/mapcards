import type { ButtonHTMLAttributes } from 'react'
import { popupCloseButton, popupCloseButtonTablet } from '../lib/popupStyles'
import { getPopupCloseIconSize, POPUP_CLOSE_ICON_PATH } from '../lib/popupClose'

interface PopupCloseButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  isTablet?: boolean
}

export default function PopupCloseButton({
  isTablet = false,
  className = '',
  'aria-label': ariaLabel = 'Close',
  type = 'button',
  ...props
}: PopupCloseButtonProps) {
  const baseClassName = isTablet ? popupCloseButtonTablet : popupCloseButton

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      className={`${baseClassName}${className ? ` ${className}` : ''}`}
      {...props}
    >
      <svg
        width={getPopupCloseIconSize(isTablet)}
        height={getPopupCloseIconSize(isTablet)}
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d={POPUP_CLOSE_ICON_PATH}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  )
}
