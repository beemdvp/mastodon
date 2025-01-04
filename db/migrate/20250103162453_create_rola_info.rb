class CreateRolaInfo < ActiveRecord::Migration[7.1]
  def change
    create_table :rola_infos do |t|
      t.string :persona
      t.string :username
      t.string :email
      t.string :password

      t.timestamps
    end
  end
end
