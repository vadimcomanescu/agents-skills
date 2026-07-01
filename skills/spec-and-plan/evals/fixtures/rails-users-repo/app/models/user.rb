class User < ApplicationRecord
  has_secure_password

  has_many :sessions, dependent: :destroy

  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :name, presence: true

  normalizes :email, with: -> { _1.strip.downcase }
end
