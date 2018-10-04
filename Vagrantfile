# -*- mode: ruby -*-
# vi: set ft=ruby :

# Application definitions
app_name = "kettle"
app_directory = "/home/vagrant/#{app_name}"

# Resource allocation
cpus = ENV["VM_CPUS"] || 2
ram = ENV["VM_RAM"] || 2048

# Node.js
nodejs_branch = "8"
nodejs_version = "8.11.4"

Vagrant.configure(2) do |config|

  config.vm.box = "inclusivedesign/fedora28"
  config.vm.hostname = app_name

  # Port-forwarding
  config.vm.network "forwarded_port", guest: 9081, host: 9081, protocol: "tcp", auto_correct: true

  # Shared folders
  config.vm.synced_folder ".", "#{app_directory}"

  # Mounts node_modules in /var/tmp to work around issues in the VirtualBox shared folders
  #
  # Set SKIP_NODE_MODULES_BIND_MOUNT to "1" to skip this and have the directory shared
  # between host and VM
  if ENV["SKIP_NODE_MODULES_BIND_MOUNT"] != "1"
    config.vm.provision "shell", run: "always", inline: <<-SHELL
      mkdir -p /var/tmp/#{app_name}/node_modules #{app_directory}/node_modules
      chown vagrant:vagrant -R /var/tmp/#{app_name}/node_modules #{app_directory}/node_modules
      mount -o bind /var/tmp/#{app_name}/node_modules #{app_directory}/node_modules
    SHELL
  end

  # VirtualBox customizations
  config.vm.provider :virtualbox do |vm|
    vm.customize ["modifyvm", :id, "--memory", ram]
    vm.customize ["modifyvm", :id, "--cpus", cpus]
    vm.customize ["modifyvm", :id, "--vram", "256"]
    vm.customize ["modifyvm", :id, "--accelerate3d", "off"]
    vm.customize ["modifyvm", :id, "--audio", "null", "--audiocontroller", "ac97"]
    vm.customize ["modifyvm", :id, "--ioapic", "on"]
    vm.customize ["setextradata", "global", "GUI/SuppressMessages", "all"]
  end

  # Install system requirements
  config.vm.provision "shell", inline: <<-SHELL
    dnf install -y --disablerepo='*' https://rpm.nodesource.com/pub_#{nodejs_branch}.x/fc/28/x86_64/nodesource-release-fc28-1.noarch.rpm
    dnf install -y gcc-c++ nodejs-#{nodejs_version}
    echo "cd #{app_directory}" >> /home/vagrant/.bashrc
  SHELL

  # Build application
  config.vm.provision "shell", privileged: false, inline: <<-SHELL
    npm install
  SHELL

end
